#!/bin/bash
sleep 60
kill -9 `ps -e | grep PalServer | awk '{print $1}'`