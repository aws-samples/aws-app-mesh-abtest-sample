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

import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface AppMeshProps {
  cluster: eks.Cluster,
  namespace?: string
}

export class AppMesh extends Construct {
  constructor(scope: Construct, id: string, props: AppMeshProps) {
    super(scope, id);

    const { cluster } = props;
    const namespace = props.namespace ?? 'appmesh-system';

    // Namespace
    const manifest = new eks.KubernetesManifest(this, 'Namespace', {
      cluster,
      manifest: [{
        apiVersion: 'v1',
        kind: 'Namespace',
        metadata: {
          name: namespace,
        }
      }]
    });

    // Service Account
    const serviceAccount = new eks.ServiceAccount(this, 'ServiceAccount', {
      cluster, namespace,
      name: 'appmesh-controller'
    });
    serviceAccount.node.addDependency(manifest);
    serviceAccount.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSAppMeshFullAccess'));
    serviceAccount.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCloudMapFullAccess'));

    // Helm Chart
    const chart = new eks.HelmChart(this, 'Chart', {
      cluster,
      chart: 'appmesh-controller',
      release: 'appmesh-controller',
      repository: 'https://aws.github.io/eks-charts',
      namespace: namespace,
      values: {
        region: cdk.Stack.of(this).region,
        serviceAccount: {
          create: false,
          name: serviceAccount.serviceAccountName
        }
      },
      wait: true
    });
    chart.node.addDependency(manifest);

    // Node Policy
    cluster.defaultNodegroup?.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSAppMeshFullAccess'));
  }
}