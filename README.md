
# Deploy TrustGraph in a RKE2 Kubernetes cluster on AWS using Pulumi

## Overview

This is an installation of TrustGraph on AWS using the RKE2 Kubernetes
platform.

The full stack includes:

- An RKE2 Kubernetes cluster with 1 'server' and multiple 'agents'.
- IAM configuration with roles/users granting Bedrock access etc.
- The EBS CSI add-on, so that Kubernetes can provision disks
- Deploys a complete TrustGraph stack of resources in Kubernetes
- AWS NLB + Nginx Gateway Fabric for ingress with Gateway API
- cert-manager with Let's Encrypt TLS certificates
- HTTPS access to TrustGraph UI and Grafana via public DNS names
- Configured to use Bedrock as an LLM service.

Keys and other configuration for the AI components are configured into
TrustGraph using secrets.

The Pulumi configuration configures a Mistral nemo instruct endpoint.

Using Bedrock LLMs requires changing Bedrock model access to change the
model you use, the resources included invoke Claude 3.5 Haiku but you
can change that in resources.yaml.

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

- `trustgraph-aws-rke:environment` - Name of the environment (e.g. dev, prod).
- `trustgraph-aws-rke:region` - AWS region (e.g. eu-west-2).
- `trustgraph-aws-rke:vpc-cidr` - CIDR block for the VPC (e.g. 172.38.0.0/16).
- `trustgraph-aws-rke:subnet-1-cidr` - CIDR block for the subnet
  (e.g. 172.38.48.0/20).
- `trustgraph-aws-rke:node-type` - EC2 instance type (e.g. t3a.xlarge).
- `trustgraph-aws-rke:agent-node-count` - Number of agent nodes.
- `trustgraph-aws-rke:ami` - AMI ID for Amazon Linux 2023 in your region.
- `trustgraph-aws-rke:domain` - Domain name for the TrustGraph UI
  (e.g. app.example.com).
- `trustgraph-aws-rke:grafana-domain` - Domain name for Grafana
  (e.g. grafana.example.com).
- `trustgraph-aws-rke:letsencrypt-email` - Email address for Let's Encrypt
  certificate registration.

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
kubectl --kubeconfig kube.cfg -n trustgraph get pods
```

If something goes wrong while deploying, retry before giving up.
`pulumi up` is a retryable command and will continue from
where it left off.

When the Pulumi scripts finish, the Kubernetes cluster will be running,
with TrustGraph deployed, but there will be a little wait for initialisation
to complete, which involves deploying storage and downloading containers.
The above `get pod` command will let you check to see when all the PODs
are running.  Allow another ~30 seconds for application initialisation
and you'll have a working system.

## DNS setup

After deployment, get the NLB DNS name:

```
pulumi stack output nlbDnsName
```

Create DNS CNAME records pointing both your domain and grafana-domain at this
NLB DNS name.  cert-manager will automatically obtain Let's Encrypt TLS
certificates once DNS resolves.

## Use the system

Once DNS is configured, access the services at:

- TrustGraph UI: `https://<your-domain>`
- Grafana: `https://<your-grafana-domain>`

Alternatively, you can use port-forwarding with the `kube.cfg` file:

```
kubectl --kubeconfig kube.cfg port-forward service/api-gateway 8088:8088
kubectl --kubeconfig kube.cfg port-forward service/trustgraph-ui 8888:8888
kubectl --kubeconfig kube.cfg port-forward service/grafana 3000:3000
```

This will allow you to access Grafana and the TrustGraph UI from your local
browser using `http://localhost:3000` and `http://localhost:8888`
respectively.

The IAM bootstrap token and Grafana admin password are auto-generated
by Pulumi.  After deployment, retrieve them with:
```
pulumi stack output iamToken --show-secrets
pulumi stack output grafanaPassword --show-secrets
```

Login to Grafana with username `admin` and the password from the command
above.

To use the TrustGraph API with authentication:
```
export TRUSTGRAPH_TOKEN=$(pulumi stack output iamToken --show-secrets)
```


## Destroy

```
pulumi destroy
```

Just say yes.  The EBS CSI driver doesn't tidy away storage, so you may
need to go delete volumes it created in EC2's 'volume' tab.

## How the config was built

```
./update-config eks-k8s 2.5.16
```

