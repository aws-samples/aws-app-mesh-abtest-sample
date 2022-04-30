//
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this
// software and associated documentation files (the "Software"), to deal in the Software
// without restriction, including without limitation the rights to use, copy, modify,
// merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
// INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
// PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
// SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//

import * as cdk from "@aws-cdk/core";
import * as eks from "@aws-cdk/aws-eks";
import * as iam from "@aws-cdk/aws-iam";

export interface CloudWatchAgentProps {
  readonly cluster: eks.Cluster;
  readonly namespace?: string;
}

export class CloudWatchAgent extends cdk.Construct {

  private namespaceManifest: eks.KubernetesManifest;

  constructor(scope: cdk.Construct, id: string, props: CloudWatchAgentProps) {
    super(scope, id);

    const { cluster } = props;
    const namespace = props.namespace ?? "amazon-cloudwatch";
    this.namespaceManifest = new eks.KubernetesManifest(this, "Namespace", {
      cluster,
      manifest: [
        {
          apiVersion: "v1",
          kind: "Namespace",
          metadata: {
            name: namespace,
          },
        },
      ],
    });

    const serviceAccount = new eks.ServiceAccount(this, "ServiceAccount", {
      cluster,
      namespace,
    });
    serviceAccount.node.addDependency(this.namespaceManifest);
    serviceAccount.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchAgentServerPolicy")
    );

    this.createCloudWatchAgent(cluster, namespace, serviceAccount.serviceAccountName);
    this.createPrometheusAgent(cluster, namespace, serviceAccount.serviceAccountName);
  }

  private createCloudWatchAgent(
    cluster: eks.Cluster,
    namespace: string,
    serviceAccountName: string
  ): void {
    new eks.KubernetesManifest(this, "CloudWatchAgentDeamonSet", {
      cluster,
      manifest: [
        {
          kind: "ClusterRole",
          apiVersion: "rbac.authorization.k8s.io/v1",
          metadata: {
            name: "cloudwatch-agent-role",
          },
          rules: [
            {
              apiGroups: [""],
              resources: ["pods", "nodes", "endpoints"],
              verbs: ["list", "watch"],
            },
            {
              apiGroups: ["apps"],
              resources: ["replicasets"],
              verbs: ["list", "watch"],
            },
            {
              apiGroups: ["batch"],
              resources: ["jobs"],
              verbs: ["list", "watch"],
            },
            {
              apiGroups: [""],
              resources: ["nodes/proxy"],
              verbs: ["get"],
            },
            {
              apiGroups: [""],
              resources: ["nodes/stats", "configmaps", "events"],
              verbs: ["create"],
            },
            {
              apiGroups: [""],
              resources: ["configmaps"],
              resourceNames: ["cwagent-clusterleader"],
              verbs: ["get", "update"],
            },
          ],
        },
        {
          kind: "ClusterRoleBinding",
          apiVersion: "rbac.authorization.k8s.io/v1",
          metadata: {
            name: "cloudwatch-agent-role-binding",
          },
          subjects: [
            {
              kind: "ServiceAccount",
              name: serviceAccountName,
              namespace,
            },
          ],
          roleRef: {
            kind: "ClusterRole",
            name: "cloudwatch-agent-role",
            apiGroup: "rbac.authorization.k8s.io",
          },
        },
        {
          apiVersion: "v1",
          kind: "ConfigMap",
          metadata: {
            name: "cwagentconfig",
            namespace,
          },
          data: {
            "cwagentconfig.json": JSON.stringify({
              logs: {
                metrics_collected: {
                  kubernetes: {
                    cluster_name: cluster.clusterName,
                    metrics_collection_interval: 60,
                  },
                },
                force_flush_interval: 5,
              },
            }),
          },
        },
        {
          apiVersion: "apps/v1",
          kind: "DaemonSet",
          metadata: {
            name: "cloudwatch-agent",
            namespace,
          },
          spec: {
            selector: {
              matchLabels: {
                name: "cloudwatch-agent",
              },
            },
            template: {
              metadata: {
                labels: {
                  name: "cloudwatch-agent",
                },
              },
              spec: {
                containers: [
                  {
                    name: "cloudwatch-agent",
                    image: "amazon/cloudwatch-agent:1.247348.0b251302",
                    resources: {
                      limits: {
                        cpu: "200m",
                        memory: "200Mi",
                      },
                      requests: {
                        cpu: "200m",
                        memory: "200Mi",
                      },
                    },
                    env: [
                      {
                        name: "HOST_IP",
                        valueFrom: {
                          fieldRef: {
                            fieldPath: "status.hostIP",
                          },
                        },
                      },
                      {
                        name: "HOST_NAME",
                        valueFrom: {
                          fieldRef: {
                            fieldPath: "spec.nodeName",
                          },
                        },
                      },
                      {
                        name: "K8S_NAMESPACE",
                        valueFrom: {
                          fieldRef: {
                            fieldPath: "metadata.namespace",
                          },
                        },
                      },
                      {
                        name: "CI_VERSION",
                        value: "k8s/1.3.8",
                      },
                    ],
                    volumeMounts: [
                      {
                        name: "cwagentconfig",
                        mountPath: "/etc/cwagentconfig",
                      },
                      {
                        name: "rootfs",
                        mountPath: "/rootfs",
                        readOnly: true,
                      },
                      {
                        name: "dockersock",
                        mountPath: "/var/run/docker.sock",
                        readOnly: true,
                      },
                      {
                        name: "varlibdocker",
                        mountPath: "/var/lib/docker",
                        readOnly: true,
                      },
                      {
                        name: "sys",
                        mountPath: "/sys",
                        readOnly: true,
                      },
                      {
                        name: "devdisk",
                        mountPath: "/dev/disk",
                        readOnly: true,
                      },
                    ],
                  },
                ],
                volumes: [
                  {
                    name: "cwagentconfig",
                    configMap: {
                      name: "cwagentconfig",
                    },
                  },
                  {
                    name: "rootfs",
                    hostPath: {
                      path: "/",
                    },
                  },
                  {
                    name: "dockersock",
                    hostPath: {
                      path: "/var/run/docker.sock",
                    },
                  },
                  {
                    name: "varlibdocker",
                    hostPath: {
                      path: "/var/lib/docker",
                    },
                  },
                  {
                    name: "sys",
                    hostPath: {
                      path: "/sys",
                    },
                  },
                  {
                    name: "devdisk",
                    hostPath: {
                      path: "/dev/disk/",
                    },
                  },
                ],
                terminationGracePeriodSeconds: 60,
                serviceAccountName: serviceAccountName,
              },
            },
          },
        },
      ],
    }).node.addDependency(this.namespaceManifest);
  }

  private createPrometheusAgent(cluster: eks.Cluster, namespace: string, serviceAccountName: string) {
    new eks.KubernetesManifest(this, "DeamonSet", {
      cluster,
      manifest: [
        {
          kind: "ClusterRole",
          apiVersion: "rbac.authorization.k8s.io/v1",
          metadata: {
            name: "cwagent-prometheus-role",
          },
          rules: [
            {
              apiGroups: [""],
              resources: [
                "nodes",
                "nodes/proxy",
                "services",
                "endpoints",
                "pods",
              ],
              verbs: ["get", "list", "watch"],
            },
            {
              apiGroups: ["extensions"],
              resources: ["ingresses"],
              verbs: ["get", "list", "watch"],
            },
            {
              nonResourceURLs: ["/metrics"],
              verbs: ["get"],
            },
          ],
        },
        {
          kind: "ClusterRoleBinding",
          apiVersion: "rbac.authorization.k8s.io/v1",
          metadata: {
            name: "cwagent-prometheus-role-binding",
          },
          subjects: [
            {
              kind: "ServiceAccount",
              name: serviceAccountName,
              namespace: namespace,
            },
          ],
          roleRef: {
            kind: "ClusterRole",
            name: "cwagent-prometheus-role",
            apiGroup: "rbac.authorization.k8s.io",
          },
        },
        {
          apiVersion: "v1",
          kind: "ConfigMap",
          metadata: {
            name: "prometheus-cwagentconfig",
            namespace: namespace,
          },
          data: {
            "cwagentconfig.json": JSON.stringify({
              logs: {
                metrics_collected: {
                  prometheus: {
                    cluster_name: cluster.clusterName,
                    log_group_name: `/aws/containerinsights/${cluster.clusterName}/prometheus`,
                    prometheus_config_path:
                      "/etc/prometheusconfig/prometheus.yaml",
                    emf_processor: {
                      metric_declaration: [
                        {
                          "source_labels": ["container_name"],
                          "label_matcher": "^envoy$",
                          "dimensions": [["ClusterName","Namespace"]],
                          "metric_selectors": [
                            "^envoy_http_downstream_rq_(total|xx)$",
                            "^envoy_cluster_upstream_cx_(r|t)x_bytes_total$",
                            "^envoy_cluster_membership_(healthy|total)$",
                            "^envoy_server_memory_(allocated|heap_size)$",
                            "^envoy_cluster_upstream_cx_(connect_timeout|destroy_local_with_active_rq)$",
                            "^envoy_cluster_upstream_rq_(pending_failure_eject|pending_overflow|timeout|per_try_timeout|rx_reset|maintenance_mode)$",
                            "^envoy_http_downstream_cx_destroy_remote_active_rq$",
                            "^envoy_cluster_upstream_flow_control_(paused_reading_total|resumed_reading_total|backed_up_total|drained_total)$",
                            "^envoy_cluster_upstream_rq_retry$",
                            "^envoy_cluster_upstream_rq_retry_(success|overflow)$",
                            "^envoy_server_(version|uptime|live)$"
                          ]
                        },
                        {
                          "source_labels": ["container_name"],
                          "label_matcher": "^envoy$",
                          "dimensions": [["ClusterName","Namespace","envoy_http_conn_manager_prefix","envoy_response_code_class"]],
                          "metric_selectors": [
                            "^envoy_http_downstream_rq_xx$"
                          ]
                        },
                        {
                          source_labels: ["job"],
                          label_matcher: "abshop",
                          dimensions: [["ClusterName", "Namespace", "app", "version"]],
                          metric_selectors: [
                            "^abshop_orders$",
                            "^abshop_oneclick$",
                          ],
                        },
                      ],
                    },
                  },
                },
                force_flush_interval: 5,
              },
            }),
          },
        },
        {
          apiVersion: "v1",
          kind: "ConfigMap",
          metadata: {
            name: "prometheus-config",
            namespace: namespace,
          },
          data: {
            "prometheus.yaml": `
global:
  scrape_interval: 1m
  scrape_timeout: 10s
scrape_configs:
- job_name: 'kubernetes-pod-appmesh-envoy'
  sample_limit: 10000
  metrics_path: /stats/prometheus
  kubernetes_sd_configs:
  - role: pod
  relabel_configs:
  - source_labels: [__meta_kubernetes_pod_container_name]
    action: keep
    regex: '^envoy$'
  - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
    action: replace
    regex: ([^:]+)(?::\d+)?;(\d+)
    replacement: ${1}:9901
    target_label: __address__
  - action: labelmap
    regex: __meta_kubernetes_pod_label_(.+)
  - action: replace
    source_labels:
    - __meta_kubernetes_namespace
    target_label: Namespace
  - source_labels: [__meta_kubernetes_pod_name]
    action: replace
    target_label: pod_name
  - action: replace
    source_labels:
    - __meta_kubernetes_pod_container_name
    target_label: container_name
  - action: replace
    source_labels:
    - __meta_kubernetes_pod_controller_name
    target_label: pod_controller_name
  - action: replace
    source_labels:
    - __meta_kubernetes_pod_controller_kind
    target_label: pod_controller_kind
  - action: replace
    source_labels:
    - __meta_kubernetes_pod_phase
    target_label: pod_phase
- job_name: kubernetes-service-endpoints
  sample_limit: 10000
  kubernetes_sd_configs:
  - role: endpoints
  relabel_configs:
  - action: keep
    regex: true
    source_labels:
    - __meta_kubernetes_service_annotation_prometheus_io_scrape
  - action: replace
    regex: (https?)
    source_labels:
    - __meta_kubernetes_service_annotation_prometheus_io_scheme
    target_label: __scheme__
  - action: replace
    regex: (.+)
    source_labels:
    - __meta_kubernetes_service_annotation_prometheus_io_path
    target_label: __metrics_path__
  - action: replace
    regex: ([^:]+)(?::\d+)?;(\d+)
    replacement: $1:$2
    source_labels:
    - __address__
    - __meta_kubernetes_service_annotation_prometheus_io_port
    target_label: __address__
  - action: labelmap
    regex: __meta_kubernetes_service_label_(.+)
  - action: replace
    source_labels:
    - __meta_kubernetes_namespace
    target_label: Namespace
  - action: replace
    source_labels:
    - __meta_kubernetes_service_name
    target_label: Service
  - action: replace
    source_labels:
    - __meta_kubernetes_pod_node_name
    target_label: kubernetes_node
  - action: replace
    source_labels:
    - __meta_kubernetes_pod_name
    target_label: pod_name
  - action: replace
    source_labels:
    - __meta_kubernetes_pod_container_name
    target_label: container_name
- job_name: 'abshop'
  sample_limit: 10000
  metrics_path: /api/v1/metrics
  kubernetes_sd_configs:
  - role: pod
  relabel_configs:
  - source_labels: [__address__]
    action: keep
    regex: '.*:8080$'
  - action: labelmap
    regex: __meta_kubernetes_pod_label_(.+)
  - action: replace
    source_labels:
    - __meta_kubernetes_namespace
    target_label: Namespace
  - source_labels: [__meta_kubernetes_pod_name]
    action: replace
    target_label: pod_name
  - action: replace
    source_labels:
    - __meta_kubernetes_pod_container_name
    target_label: container_name
  - action: replace
    source_labels:
    - __meta_kubernetes_pod_controller_name
    target_label: pod_controller_name
  - action: replace
    source_labels:
    - __meta_kubernetes_pod_controller_kind
    target_label: pod_controller_kind
  - action: replace
    source_labels:
    - __meta_kubernetes_pod_phase
    target_label: pod_phase
            `,
          },
        },
        {
          apiVersion: "apps/v1",
          kind: "Deployment",
          metadata: {
            name: "cwagent-prometheus",
            namespace: namespace,
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                app: "cwagent-prometheus",
              },
            },
            template: {
              metadata: {
                labels: {
                  app: "cwagent-prometheus",
                },
              },
              spec: {
                containers: [
                  {
                    name: "cloudwatch-agent",
                    image: "amazon/cloudwatch-agent:1.247348.0b251302",
                    imagePullPolicy: "Always",
                    resources: {
                      limits: {
                        cpu: "1000m",
                        memory: "1000Mi",
                      },
                      requests: {
                        cpu: "200m",
                        memory: "200Mi",
                      },
                    },
                    env: [
                      {
                        name: "CI_VERSION",
                        value: "k8s/1.3.8",
                      },
                    ],
                    volumeMounts: [
                      {
                        name: "prometheus-cwagentconfig",
                        mountPath: "/etc/cwagentconfig",
                      },
                      {
                        name: "prometheus-config",
                        mountPath: "/etc/prometheusconfig",
                      },
                    ],
                  },
                ],
                volumes: [
                  {
                    name: "prometheus-cwagentconfig",
                    configMap: {
                      name: "prometheus-cwagentconfig",
                    },
                  },
                  {
                    name: "prometheus-config",
                    configMap: {
                      name: "prometheus-config",
                    },
                  },
                ],
                terminationGracePeriodSeconds: 60,
                serviceAccountName: serviceAccountName,
              },
            },
          },
        },
      ],
    }).node.addDependency(this.namespaceManifest);
  }
}
