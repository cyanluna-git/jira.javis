#!/bin/bash
export TERM=xterm
sshpass -p 'edwards@!' ssh -o StrictHostKeyChecking=no -t geraldpark@10.82.37.79 "python3 ~/scripts/monitor_backup.py"