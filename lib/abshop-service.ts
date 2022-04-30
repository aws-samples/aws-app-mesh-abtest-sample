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
import * as assets from '@aws-cdk/aws-ecr-assets';

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml'

export interface ABShopServiceProps {
  cluster: eks.Cluster
  manifestFile: string
  manifestContainerName?: string
  imageDirectory: string
}

export class ABShopService extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: ABShopServiceProps) {
    super(scope, id);

    const image = new assets.DockerImageAsset(this, 'ImageServiceImage', {
      directory: path.join(__dirname, props.imageDirectory)
    });

    const manifestContainerName = props.manifestContainerName ?? id.toLowerCase();

    const manifestContent = yaml.loadAll(fs.readFileSync(path.join(__dirname, props.manifestFile), 'utf8')) as any;
    manifestContent.filter((m: { kind: string; }) => m.kind == 'Deployment').forEach((deployment: { spec: { template: { spec: { containers: any[]; }; }; }; }) => {
      const container = deployment.spec.template.spec.containers.find((c: { name: string; }) => c.name.toLowerCase() == manifestContainerName);
      container.image = image.imageUri;
    });
    new eks.KubernetesManifest(this, 'Manifest', { cluster: props.cluster, manifest: manifestContent });
  }
}