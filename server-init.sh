#!/bin/bash

exec >/tmp/output 2>&1
set -x

(
    echo '#!/bin/sh'
    echo ''
    echo 'count=500'
    echo 'file=/etc/rancher/rke2/rke2.yaml'
    echo ''
    echo 'while true'
    echo 'do'
    echo ''
    echo '    if [ -f ${file} ]'
    echo '    then'
    echo '        break'
    echo '    fi'
    echo ''
    echo '    count=$(($count - 1))'
    echo ''
    echo '    if [ $count -lt 1 ]'
    echo '    then'
    echo '        echo Failed to get kubeconfig 1>&2'
    echo '        exit 1'
    echo '    fi'
    echo ''
    echo '    sleep 1'
    echo ''
    echo 'done'
    echo ''
    echo 'count=100'
    echo ''
    echo 'while true'
    echo 'do'
    echo ''
    echo '    /var/lib/rancher/rke2/bin/kubectl --kubeconfig ${file} get all >/dev/null 2>&1'
    echo '    if [ $? -eq 0 ]'
    echo '    then'
    echo '        cat ${file}'
    echo '        exit 0'
    echo '    fi'
    echo ''
    echo '    count=$(($count - 1))'
    echo ''
    echo '    if [ $count -lt 1 ]'
    echo '    then'
    echo '        echo Failed to get working k8s 1>&2'
    echo '        exit 1'
    echo '    fi'
    echo ''
    echo '    sleep 1'
    echo ''
    echo 'done'
) > /usr/local/bin/wait-for-kubeconfig
chmod 755 /usr/local/bin/wait-for-kubeconfig

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

