const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {spawnSync} = require('node:child_process');
const source = readFileSync('scripts/install-local.sh', 'utf8');
const helpers = source.slice(source.indexOf('formula_process_status()'), source.indexOf('require_formula_stopped || exit 1'));
function run(body, statuses = [1]) {
  // All filesystem/launch commands in the extracted production paths are shell mocks.
  const result = spawnSync('bash', ['-c', `set -euo pipefail
${helpers}
statuses=(${statuses.join(' ')})
index=0
pgrep() {
  [[ "$1" == -f && "$2" == -x && "$3" == '/Applications/Formula[.]app/Contents/MacOS/Formula([[:space:]].*)?' ]] || exit 99
  local result=\${statuses[$index]:-1}
  index=$((index+1))
  return "$result"
}
mv() { echo "MOVE $*"; }
open() { echo "OPEN $*"; }
sleep() { :; }
task_target=/mock/Formula.app
task_previous=/mock/previous.app
task_stage=/mock/stage
task_backup=/mock/backup
${body}`], {encoding: 'utf8'});
  assert.ifError(result.error);
  return {...result, output: result.stdout + result.stderr};
}
for (const status of [0, 2, 3, 127]) {
  const r = run('require_formula_stopped || exit 1; echo REPLACED', [status]);
  assert.equal(r.status, 1);
  assert(!r.output.includes('REPLACED'));
  assert(r.output.includes(status === 0 ? 'SAVE_AND_QUIT_FORMULA' : '进程检测失败'), JSON.stringify(r));
}
assert.equal(run('require_formula_stopped || exit 1; echo ALLOWED').status, 0);
// Exercise the production POSIX ERE using the system matcher, not JavaScript RegExp.
// This does not substitute for live macOS pgrep process enumeration.
const pattern = source.match(/if pgrep -f -x '([^']+)'/)[1];
for (const [command, expected] of [
  ['/Applications/Formula.app/Contents/MacOS/Formula', 0],
  ['/Applications/Formula.app/Contents/MacOS/Formula --document /tmp/example', 0],
  ['/Applications/Formula.app/Contents/MacOS/Formula\t--document', 0],
  ['/Applications/FormulaXapp/Contents/MacOS/Formula', 1],
  ['echo /Applications/Formula.app/Contents/MacOS/Formula', 1],
  ['/Applications/Formula.app/Contents/MacOS/Formula-helper', 1],
]) {
  const match = spawnSync('/usr/bin/grep', ['-E', '-x', pattern], {input: command + '\n', encoding: 'utf8'});
  assert.ifError(match.error);
  assert.equal(match.status, expected, `${command}: ${match.stderr}`);
}
assert(source.indexOf('require_formula_stopped || exit 1') < source.indexOf('task_stage=$(mktemp'));
assert(source.includes('require_formula_stopped || exit 1\nmv "$task_target" "$task_previous"'));
const launch = source.slice(source.indexOf('open -n "$task_target"'));
let r = run(launch, [2]);
assert.equal(r.status, 1); assert(!r.output.includes('MOVE')); assert(r.output.includes('保留当前应用'), JSON.stringify(r));
r = run(launch, [0]);
assert.equal(r.status, 0); assert(r.output.includes('MOVE /mock/previous.app /mock/stage/previous.app'));
r = run(launch, Array(10).fill(1).concat(2));
assert.equal(r.status, 1); assert(!r.output.includes('MOVE')); assert(r.output.includes('未回滚'));
r = run(launch, Array(10).fill(1).concat(0));
assert.equal(r.status, 0); assert(!r.output.includes('MOVE'));
r = run(launch, Array(11).fill(1));
assert.equal(r.status, 1); assert(r.output.includes('MOVE /mock/Formula.app /mock/stage/failed.app')); assert(r.output.includes('MOVE /mock/previous.app /mock/Formula.app'));
console.log('PASS install-local process guards, POSIX ERE matching, launch confirmation and safe rollback (mock commands only)');
