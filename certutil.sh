#!/bin/sh

# Generate a self signed certificate for development purposes
mkdir dev
openssl req -newkey rsa:2048 -new -nodes -x509 -days 365 -keyout dev/key.pem -out dev/cert.pem

