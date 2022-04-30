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

export interface AppMeshGatewayProps {
  cluster: eks.Cluster;
  name?: string;
  namespace?: string;
}

export class AppMeshGateway extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: AppMeshGatewayProps) {
    super(scope, id);

    const { cluster } = props;
    const namespace = props.namespace ?? "default";
    const name = props.name ?? "gateway";

    // Namespace
    new eks.KubernetesManifest(this, "Manifest", {
      cluster,
      manifest: [
        {
          apiVersion: "appmesh.k8s.aws/v1beta2",
          kind: "VirtualGateway",
          metadata: {
            name,
            namespace,
          },
          spec: {
            namespaceSelector: {
              matchLabels: {
                gateway: name,
              },
            },
            podSelector: {
              matchLabels: {
                app: name,
              },
            },
            listeners: [
              {
                portMapping: {
                  port: 8088,
                  protocol: "http",
                },
              },
            ],
          },
        },
        {
          apiVersion: "v1",
          kind: "Service",
          metadata: {
            name,
            namespace,
            annotations: {
              "service.beta.kubernetes.io/aws-load-balancer-type": "nlb",
            },
          },
          spec: {
            type: "LoadBalancer",
            ports: [
              {
                port: 80,
                targetPort: 8088,
                name: "http",
              },
            ],
            selector: {
              app: name,
            },
          },
        },
        {
          apiVersion: "apps/v1",
          kind: "Deployment",
          metadata: {
            name,
            namespace,
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                app: name,
              },
            },
            template: {
              metadata: {
                labels: {
                  app: name,
                },
              },
              spec: {
                containers: [
                  {
                    name: "envoy",
                    image:
                      "840364872350.dkr.ecr.eu-west-1.amazonaws.com/aws-appmesh-envoy:v1.20.0.1-prod",
                    ports: [
                      {
                        containerPort: 8088,
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      ],
    });
  }
}
