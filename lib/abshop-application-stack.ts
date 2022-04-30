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

import * as cdk from '@aws-cdk/core';
import * as eks from '@aws-cdk/aws-eks';
import { ABShopService } from './abshop-service';
import { KubernetesManifestFile } from './KubernetesManifestFile';
import { AppMeshGateway } from './AppMeshGateway';

export interface ABShopApplicationProps {
  cluster: eks.Cluster
}

export class ABShopApplicationStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: ABShopApplicationProps) {
    super(scope, id);

    const { cluster } = props;
    // Create Application resources
    const application = new KubernetesManifestFile(this, 'ApplicationManifest', { cluster, manifestFile: '../manifests/application.yaml' });
    // Create the App Mesh Gateway
    const gateway = new AppMeshGateway(this, 'Gateway', { cluster, namespace: 'abshop', name: 'abshop-gw' });
    gateway.node.addDependency(application);
    // Create the redis
    new KubernetesManifestFile(this, 'Redis', { cluster, manifestFile: '../manifests/services/redis.yaml' })
      .node.addDependency(application);
    // Create the image service
    new ABShopService(this, 'ImageService', {
      cluster,
      imageDirectory: '../src/imageservice',
      manifestFile: '../manifests/services/imageservice.yaml'
    }).node.addDependency(application);
    // Create the catalog service
    new ABShopService(this, 'CatalogService', {
      cluster,
      imageDirectory: '../src/catalogservice',
      manifestFile: '../manifests/services/catalogservice.yaml'
    }).node.addDependency(application);
    // Create the cart service
    new ABShopService(this, 'CartService', {
      cluster,
      imageDirectory: '../src/cartservice',
      manifestFile: '../manifests/services/cartservice.yaml',
    }).node.addDependency(application);
    // Create the order service
    new ABShopService(this, 'OrderService', {
      cluster,
      imageDirectory: '../src/orderservice',
      manifestFile: '../manifests/services/orderservice.yaml',
    }).node.addDependency(application);
    // Create the recommender service
    new ABShopService(this, 'RecommenderService', {
      cluster,
      imageDirectory: '../src/recommenderservice',
      manifestFile: '../manifests/services/recommenderservice.yaml',
    }).node.addDependency(application);
    // Create the frontend service
    const frontend = new ABShopService(this, 'FrontendService', {
      cluster,
      imageDirectory: '../src/frontend',
      manifestFile: '../manifests/services/frontend.yaml',
      manifestContainerName: 'frontend'
    });
    frontend.node.addDependency(application);
    frontend.node.addDependency(gateway);
    // Create the Load Generator
    new ABShopService(this, 'LoadGenerator', {
      cluster,
      imageDirectory: '../src/loadgen',
      manifestFile: '../manifests/services/loadgen.yaml',
      manifestContainerName: 'loadtester'
    }).node.addDependency(application);
  }
}
