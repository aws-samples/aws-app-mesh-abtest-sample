# A/B Testing sample using AWS App Mesh
The code in this repository is supporting the example provided by the blog post __A/B Test applications with AWS App Mesh__. It is a modified version of the application created by [Christoph Kassen](https://github.com/ckassen) for the AWS re:Invent 2018 workshop.

> Note: Deploying this sample application to your AWS account will incure charges.

## Getting started
Before deploying the sample you first need to download and install the this repository by running to following commands.

```sh
git clone https://github.com/aws-samples/aws-app-mesh-abtest-sample.git
cd aws-app-mesh-abtest-sample
npm install
```

The Docker images for this application are build locally before storing them in Amazon ECR. For this reason you need to be able to build Docker container, for instance with [Docker Desktop](https://www.docker.com/products/docker-desktop).

## Deployment
This code sample is using [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/home.html) for deploying the infrastructure and application.

### Infrastructure
The infrastructure needs to be deployed to your AWS account first.

```sh
npm run deploy-infrastructure
```

This will create a Kubernetes cluster using Amazon EKS and supporting resources which are required for the cluster and application.

### Application
For deploying the application you can exucute the following command.

```sh
npm run deploy-application
```

### A/B Test
To start the A/B test you should apply the Kubernetes manifest using `kubectl`. This will configure the routing configuration using AWS App Mesh.

```sh
kubectl apply -f ./manifests/frontend-abtest.yaml 
```

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.
