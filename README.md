
# Deploy TrustGraph in a RKE2 Kubernetes cluster on AWS using Pulumi

## Overview

This is an installation of TrustGraph on AWS using the RKE2 Kubernetes
platform.

The full stack includes:

- A Kubernetes cluster
- Node pool containing 2 nodes
- An IAM application plus policy granting Gen AI access
- Deploys a complete TrustGraph stack of resources in AKS

Keys and other configuration for the AI components are configured into
TrustGraph using secrets.

The Pulumi configuration configures a Mistral nemo instruct endpoint.

## How it works

This uses Pulumi which is a deployment framework, similar to Terraform
but:
- Pulumi has an open source licence
- Pulumi uses general-purposes programming languages, particularly useful
  because you can use test frameworks to test the infrastructure.

Roadmap to deploy is:
- Install Pulumi
- Setup Pulumi
- Configure your environment with AWS credentials
- Modify the local configuration to do what you want
- Deploy
- Use the system

# Deploy

## Deploy Pulumi

```
cd pulumi
```

Then:

```
npm install
```

## Setup Pulumi

You need to tell Pulumi which state to use.  You can store this in an S3
bucket, but for experimentation, you can just use local state:

```
pulumi login --local
```

Pulumi operates in stacks, each stack is a separate deployment.  The
git repo contains the configuration for a single stack `aws`, so you
could:

```
pulumi stack init aws
```

and it will use the configuration in `Pulumi.aws.yaml`.

## Configure your environment with AWS credentials

See AWS docs on setting up .aws/credentials

## Modify the local configuration to do what you want

You can edit:
- settings in `Pulumi.STACKNAME.yaml` e.g. Pulumi.aws.yaml
- change `resources.yaml` with whatever you want to deploy.
  The resources.yaml file was created using the TrustGraph config portal,
  so you can re-generate your own.

The `Pulumi.STACKNAME.yaml` configuration file contains settings for:

```
  trustgraph-aws-rke:environment: dev
  trustgraph-aws-rke:region: us-west-2
  trustgraph-aws-rke:vpc-cidr: 172.38.0.0/16
  trustgraph-aws-rke:subnet-1-cidr: 172.38.48.0/20
  trustgraph-aws-rke:node-type: t3a.xlarge
  trustgraph-aws-rke:node-count: 3
```

## Deploy

```
pulumi up
```

Just say yes.

If everything works:
- A file `kube.cfg` will also be created which provides access
  to the Kubernetes cluster.

To connect to the Kubernetes cluster...

```
kubectl --kubeconfig kubeconfig -n trustgraph get pods
```

If something goes wrong while deploying, retry before giving up.
`pulumi up` is a retryable command and will continue from
where it left off.

## Use the system

To get access to TrustGraph using the `kube.cfg` file, set up some
port-forwarding.  You'll need multiple terminal windows to run each of
these commands:

```
kubectl --kubeconfig kube.cfg port-forward service/api-gateway 8088:8088
kubectl --kubeconfig kube.cfg port-forward service/workbench-ui 8888:8888
kubectl --kubeconfig kube.cfg port-forward service/grafana 3000:3000
```

This will allow you to access Grafana and the Workbench UI from your local
browser using `http://localhost:3000` and `http://localhost:8888`
respectively.


## Deploy

```
pulumi destroy
```

Just say yes.

