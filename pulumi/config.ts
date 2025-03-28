
// Configuration stuff, largely loading stuff from the configuration file

import * as pulumi from "@pulumi/pulumi";

const cfg = new pulumi.Config();

function get(tag : string) {

    let val = cfg.get(tag);

    if (!val) {
        console.log("ERROR: The '" + tag + "' config is mandatory");
        throw "The '" + tag + "' config is mandatory";
    }

    return val;

}

// Get 'environment', should be something like live, dev, ref etc.
export const environment = get("environment");

// Get 'region', should be something like live, dev, ref etc.
export const region = get("region");

// Default tags
export const tags : { [key : string] : string } = {
};

export const tagsSep = Object.entries(tags).map(
    (x : string[]) => (x[0] + "=" + x[1])
).join(",");

// Make up a cluster name
export const prefix = "trustgraph-" + environment;

// VPC configuration
export const vpcCidr = get("vpc-cidr");
export const subnet1Cidr = get("subnet-1-cidr");

// Volume size
export const volumeSize = 20;
export const nodeType = get("node-type");
export const nodeCount = Number(get("node-count"));

// Amazon Linux 2023, x86-64 in us-west-2 (Oregon).
export const ami = "ami-0f9d441b5d66d5f31";

