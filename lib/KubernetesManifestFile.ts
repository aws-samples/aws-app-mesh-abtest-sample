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
import * as eks from 'aws-cdk-lib/aws-eks';

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface KubernetesManifestFileProps {
  readonly cluster: eks.ICluster;
  readonly manifestFile: string;
} 

export class KubernetesManifestFile extends eks.KubernetesManifest {
  constructor(scope: Construct, id: string, props: KubernetesManifestFileProps) {
    super(scope, id, { cluster: props.cluster, manifest: yaml.loadAll(fs.readFileSync(path.join(__dirname, props.manifestFile), 'utf8')) as any });
  }
}