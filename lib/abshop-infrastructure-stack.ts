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

import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as eks from "aws-cdk-lib/aws-eks";
import { AppMesh } from "./AppMesh";
import { CloudWatchAgent } from "./CloudWatchAgent";

export class ABShopInfrastructureStack extends cdk.Stack {
  public cluster: eks.Cluster;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    var vpc = new ec2.Vpc(this, "VPC");
    this.cluster = new eks.Cluster(this, "Cluster", {
      vpc,
      version: eks.KubernetesVersion.V1_28,
      defaultCapacity: 3,
    });

    new cdk.CfnOutput(this, "UpdateKubeConfig", {
      value: `aws eks update-kubeconfig --name ${this.cluster.clusterName} --region ${this.region} --role-arn ${this.cluster.kubectlRole?.roleArn}`,
    });

    // Container Insights
    new CloudWatchAgent(this, "CloudWatchAgent", { cluster: this.cluster });

    // App Mesh
    new AppMesh(this, "AppMesh", { cluster: this.cluster });
  }
}
