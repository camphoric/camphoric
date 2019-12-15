#!/bin/bash
# Quick script for easy starting of both server and client dev envs.
cd client
yarn start &
cd ../server
python manage.py runserver
cd ../
kill %1
