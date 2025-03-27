#!/bin/bash

exec >/tmp/output 2>&1
set -x

apt update
apt upgrade

apt install -y python3 python3-pip unzip python3-venv
pip install --break-system-packages awscli

curl -sfL https://get.rke2.io | sh -

(
    echo 'write-kubeconfig-mode: "0644"'
    echo 'token: %TOKEN%'
    echo 'debug: true'
    echo 'tls-san:'
    echo "  - %MY-IP%"
) > /etc/rancher/rke2/config.yaml

systemctl enable rke2-server
systemctl start rke2-server

