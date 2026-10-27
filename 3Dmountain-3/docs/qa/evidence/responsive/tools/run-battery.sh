#!/bin/bash
# Responsive battery for index1-5 (QA only). Each probe waits for the shared browser lock on its own.
# Usage (from the project root): bash docs/qa/evidence/responsive/tools/run-battery.sh [list...]
cd "$(dirname "$0")/../../../../.."
S=docs/qa/evidence/responsive/tools
run() { # name mode vpargs...
  local name=$1 mode=$2; shift 2
  local extra=""; [ "$mode" = world ] && extra="--world"
  echo "=== $name ($mode) $(date +%T)"
  RESP_MODE=$mode RESP_WAIT=${RESP_WAIT:-1500} RESP_DIR=.qa/index1-5/$name node scripts/index1-5/probe.cjs --script $S/resp-audit.probe.cjs $extra "$@" --out $name --timeout 1700 2>&1 | grep -E "^(probe|errors|json|·.*(排隊|FAIL))" | cut -c1-600
}
for job in "${@:-all}"; do
 case $job in
  all)
   $0 j390 w390 j1440 w1440 j1280 w1280 j768 w768 j1920 w1920 j2560 w2560 j1440s w1440s j360 w360 j1024 w1024 ;;
  j390)  run resp-j390 journey --w 390 --h 844 --phone ;;
  w390)  run resp-w390 world --w 390 --h 844 --phone ;;
  j360)  run resp-j360 journey --w 360 --h 740 ;;
  w360)  run resp-w360 world --w 360 --h 740 ;;
  j768)  run resp-j768 journey --w 768 --h 1024 ;;
  w768)  run resp-w768 world --w 768 --h 1024 ;;
  j1024) run resp-j1024 journey --w 1024 --h 768 ;;
  w1024) run resp-w1024 world --w 1024 --h 768 ;;
  j1280) run resp-j1280 journey --w 1280 --h 720 ;;
  w1280) run resp-w1280 world --w 1280 --h 720 ;;
  j1440) run resp-j1440 journey --w 1440 --h 900 ;;
  w1440) run resp-w1440 world --w 1440 --h 900 ;;
  j1920) run resp-j1920 journey --w 1920 --h 1080 ;;
  w1920) run resp-w1920 world --w 1920 --h 1080 ;;
  j2560) run resp-j2560 journey --w 2560 --h 1440 ;;
  w2560) run resp-w2560 world --w 2560 --h 1440 ;;
  j1440s) run resp-j1440s journey --w 1440 --h 600 ;;
  w1440s) run resp-w1440s world --w 1440 --h 600 ;;
 esac
done
