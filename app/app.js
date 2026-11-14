(function () {
  'use strict';
  var APP_ID = 'org.webosbrew.arcguard';
  var DATA = '/var/lib/webosbrew/arcguard';
  var HOOK = '/var/lib/webosbrew/init.d/50-orgwebosbrew-arcguard';
  var APPDIR = '/media/developer/apps/usr/palm/applications/' + APP_ID;
  var WATCH = APPDIR + '/bin/arcguard-watch.sh';
  var busy = false;
  var labels = {
    external_arc: 'HDMI ARC / eARC', tv_speaker: 'TV internal speakers', external_optical: 'Optical',
    bt_soundbar: 'Bluetooth soundbar', lineout: 'Line out', headphone: 'Headphones',
    unknown: 'Unknown / unavailable'
  };
  function $(id) { return document.getElementById(id); }
  function toast(text) {
    var node = $('toast'); node.textContent = text; node.style.display = 'block';
    clearTimeout(toast.timer); toast.timer = setTimeout(function () { node.style.display = 'none'; }, 3200);
  }
  function setBusy(value) {
    busy = value;
    ['refreshBtn','applyBtn','saveBtn','pauseBtn','resumeBtn','installBtn','removeBtn'].forEach(function (id) { $(id).disabled = value; });
  }
  function pickerList(trigger) {
    return $(trigger.getAttribute('aria-controls'));
  }
  function getPickerValue(id) {
    return $(id).getAttribute('data-value');
  }
  function setPickerValue(id, value) {
    var trigger = $(id);
    var list = pickerList(trigger);
    var options = Array.prototype.slice.call(list.querySelectorAll('[role=option]'));
    var selected = options.filter(function (option) { return option.getAttribute('data-value') === String(value); })[0] || options[0];
    if (!selected) return;
    trigger.setAttribute('data-value', selected.getAttribute('data-value'));
    trigger.querySelector('.picker-current').textContent = selected.textContent;
    options.forEach(function (option) {
      option.setAttribute('aria-selected', option === selected ? 'true' : 'false');
    });
  }
  function closePicker(trigger, restoreFocus) {
    var list = pickerList(trigger);
    list.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.closest('.remote-picker').classList.remove('open', 'opens-up');
    list.style.maxHeight = '';
    if (restoreFocus) trigger.focus();
  }
  function openPicker(trigger) {
    Array.prototype.slice.call(document.querySelectorAll('.picker-trigger[aria-expanded="true"]')).forEach(function (other) {
      if (other !== trigger) closePicker(other, false);
    });
    var list = pickerList(trigger);
    var wrapper = trigger.closest('.remote-picker');
    list.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    wrapper.classList.add('open');
    var view = trigger.closest('.views');
    var viewRect = view.getBoundingClientRect();
    var triggerRect = trigger.getBoundingClientRect();
    var maxHeight = Math.min(300, Math.floor(window.innerHeight * 0.38));
    var below = viewRect.bottom - triggerRect.bottom - 10;
    var above = triggerRect.top - viewRect.top - 10;
    var openUp = below < Math.min(list.scrollHeight, maxHeight) && above > below;
    wrapper.classList.toggle('opens-up', openUp);
    list.style.maxHeight = Math.max(80, Math.min(maxHeight, openUp ? above : below)) + 'px';
    var selected = list.querySelector('[aria-selected="true"]') || list.querySelector('[role=option]');
    if (selected) {
      selected.focus();
      selected.scrollIntoView({ block: 'nearest' });
    }
  }
  function bindPickers() {
    Array.prototype.slice.call(document.querySelectorAll('.picker-trigger')).forEach(function (trigger) {
      var list = pickerList(trigger);
      trigger.addEventListener('click', function () {
        if (trigger.getAttribute('aria-expanded') === 'true') closePicker(trigger, true);
        else openPicker(trigger);
      });
      Array.prototype.slice.call(list.querySelectorAll('[role=option]')).forEach(function (option, index, options) {
        option.addEventListener('click', function () {
          setPickerValue(trigger.id, option.getAttribute('data-value'));
          closePicker(trigger, true);
        });
        option.addEventListener('keydown', function (event) {
          var code = event.keyCode || event.which;
          var up = event.key === 'ArrowUp' || code === 38;
          var down = event.key === 'ArrowDown' || code === 40;
          var horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight' || code === 37 || code === 39;
          var back = event.key === 'Escape' || event.key === 'Backspace' || event.key === 'Back' || event.key === 'GoBack' || code === 8 || code === 27 || code === 461;
          if (back) {
            event.preventDefault();
            event.stopPropagation();
            closePicker(trigger, true);
          } else if (horizontal) {
            closePicker(trigger, true);
          } else if (up || down) {
            var next = index + (up ? -1 : 1);
            if (next >= 0 && next < options.length) {
              event.preventDefault();
              options[next].focus();
              options[next].scrollIntoView({ block: 'nearest' });
            } else {
              closePicker(trigger, true);
            }
          }
        });
      });
    });
    document.addEventListener('click', function (event) {
      Array.prototype.slice.call(document.querySelectorAll('.picker-trigger[aria-expanded="true"]')).forEach(function (trigger) {
        if (!trigger.closest('.remote-picker').contains(event.target)) closePicker(trigger, false);
      });
    });
  }
  function rootExec(command) {
    return new Promise(function (resolve, reject) {
      function unpack(result) {
        if (result && result.error) { reject(new Error(result.error)); return; }
        resolve((result && (result.stdoutString !== undefined ? result.stdoutString : result.stdout)) || '');
      }
      function failed(error) { reject(new Error((error && (error.errorText || error.message)) || 'Root execution request failed.')); }
      if (window.webOS && webOS.service && webOS.service.request) {
        webOS.service.request('luna://org.webosbrew.hbchannel.service', {
          method: 'exec', parameters: { command: command }, onSuccess: unpack, onFailure: failed
        });
        return;
      }
      if (window.PalmServiceBridge) {
        var bridge = new PalmServiceBridge();
        bridge.onservicecallback = function (payload) {
          try { unpack(JSON.parse(payload)); } catch (e) { failed(e); }
        };
        bridge.call('luna://org.webosbrew.hbchannel.service/exec', JSON.stringify({ command: command }));
        return;
      }
      reject(new Error('No webOS Luna bridge is available in this app context.'));
    });
  }
  function b64Ascii(s) { return btoa(s); }
  function escapeSh(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }
  function readFile(path) { return rootExec('cat ' + escapeSh(path) + ' 2>/dev/null || true'); }
  function stopWatcherCommand() {
    var pidFile = DATA + '/watcher.pid';
    return 'if [ -f ' + escapeSh(pidFile) + ' ]; then pid=$(cat ' + escapeSh(pidFile) + ' 2>/dev/null); case "$pid" in ""|*[!0-9]*) ;; *) if kill -0 "$pid" 2>/dev/null && tr \'\\000\' \' \' < "/proc/$pid/cmdline" 2>/dev/null | grep -Fq ' + escapeSh(WATCH) + '; then kill "$pid" 2>/dev/null || true; fi ;; esac; rm -f ' + escapeSh(pidFile) + '; fi';
  }
  function readSettings() {
    return readFile(DATA + '/config.env').then(function (raw) {
      var out = {};
      String(raw).split(/\r?\n/).forEach(function (line) {
        var p = line.indexOf('='); if (p > 0) out[line.slice(0,p)] = line.slice(p+1).trim();
      });
      if (out.enabled !== '0' && out.enabled !== '1') out.enabled = '0';
      if (!labels[out.target] || out.target === 'unknown' || out.target === 'alsa') out.target = 'external_arc';
      if (!['2','3','5','10'].includes(out.interval)) out.interval = '3';
      if (!['0','10','20','45','90'].includes(out.startup_delay)) out.startup_delay = '20';
      if (!/^\d+$/.test(out.pause_until || '')) out.pause_until = '0';
      return out;
    });
  }
  function saveSettings(extra) {
    var settings = {
      enabled: $('enabled').checked ? '1' : '0', target: getPickerValue('target'),
      interval: getPickerValue('interval'), startup_delay: getPickerValue('startupDelay'),
      pause_until: extra && extra.pause_until !== undefined ? String(extra.pause_until) : ((lastSettings && lastSettings.pause_until) || '0')
    };
    var config = 'enabled=' + settings.enabled + '\ntarget=' + settings.target + '\ninterval=' + settings.interval + '\nstartup_delay=' + settings.startup_delay + '\npause_until=' + settings.pause_until + '\n';
    return rootExec('mkdir -p ' + escapeSh(DATA) + ' && printf %s ' + escapeSh(b64Ascii(config)) + ' | base64 -d > ' + escapeSh(DATA + '/config.env') + ' && chmod 600 ' + escapeSh(DATA + '/config.env')).then(function () {
      lastSettings = settings; return settings;
    });
  }
  var lastSettings = null;
  function applySettings(s) {
    lastSettings = s;
    $('enabled').checked = s.enabled === '1';
    setPickerValue('target', labels[s.target] ? s.target : 'external_arc');
    setPickerValue('interval', s.interval); setPickerValue('startupDelay', s.startup_delay);
    $('targetOutputReadout').textContent = labels[s.target] || s.target;
  }
  function showStatus(raw, runtime) {
    var s;
    try { s = JSON.parse(String(raw).trim()); } catch (_) { s = null; }
    if (!s || typeof s !== 'object') {
      $('serviceBadge').className = 'badge ' + (runtime.watcherRunning ? 'muted' : 'off');
      $('serviceBadge').textContent = runtime.watcherRunning ? 'Watcher starting' : 'Watcher stopped';
      $('currentOutput').textContent = 'Not reporting'; $('lastAction').textContent = 'Waiting for watcher';
      $('statusDetail').textContent = runtime.watcherRunning
        ? 'The watcher is running and waiting for its first status update.'
        : runtime.hookInstalled
          ? 'The watcher has not started. Check Diagnostics and Homebrew root access.'
          : 'The background watcher is not running. Install the boot service, then reopen ARC Guard to start it.';
      $('corrections').textContent = '—'; return;
    }
    $('serviceBadge').className = 'badge ' + (!runtime.watcherRunning ? 'muted' : (s.enabled ? 'on' : 'off'));
    $('serviceBadge').textContent = !runtime.watcherRunning ? 'Watcher stopped' : (s.enabled ? 'Enforcement enabled' : 'Enforcement disabled');
    $('currentOutput').textContent = labels[s.current] || s.current || 'Unknown';
    $('targetOutputReadout').textContent = labels[s.target] || s.target || '—';
    $('lastAction').textContent = s.lastAction || '—';
    $('corrections').textContent = (s.corrections === undefined ? '0' : String(s.corrections));
    var checked = s.lastCheck ? new Date(Number(s.lastCheck) * 1000).toLocaleTimeString() : 'not yet';
    var pauseText = s.pausedUntil && Number(s.pausedUntil) > Math.floor(Date.now()/1000) ? ' · paused until ' + new Date(Number(s.pausedUntil)*1000).toLocaleTimeString() : '';
    $('statusDetail').textContent = 'Last check: ' + checked + pauseText + (runtime.watcherRunning ? ' · watcher running' : ' · watcher not running');
    $('errorLine').textContent = s.lastError ? s.lastError : 'No errors reported.';
  }
  function readRuntimeState() {
    var pidFile = DATA + '/watcher.pid';
    var command = 'installed=0; running=0; ' +
      'if [ -x ' + escapeSh(HOOK) + ' ] && [ "$(readlink ' + escapeSh(HOOK) + ' 2>/dev/null)" = ' + escapeSh(APPDIR + '/boot.sh') + ' ]; then installed=1; fi; ' +
      'if [ -f ' + escapeSh(pidFile) + ' ]; then pid=$(cat ' + escapeSh(pidFile) + ' 2>/dev/null); case "$pid" in ""|*[!0-9]*) ;; *) if kill -0 "$pid" 2>/dev/null && tr \'\\000\' \' \' < "/proc/$pid/cmdline" 2>/dev/null | grep -Fq ' + escapeSh(WATCH) + '; then running=1; fi ;; esac; fi; ' +
      'printf "%s %s\\n" "$installed" "$running"';
    return rootExec(command).then(function (raw) {
      var parts = String(raw).trim().split(/\s+/);
      return { hookInstalled: parts[0] === '1', watcherRunning: parts[1] === '1' };
    });
  }
  function recoverWatcherOnLaunch() {
    return readRuntimeState().then(function (state) {
      if (!state.hookInstalled || state.watcherRunning) return state;
      return rootExec(escapeSh(HOOK) + ' && sleep 1').then(readRuntimeState).then(function (afterStart) {
        if (afterStart.watcherRunning) toast('ARC Guard found the watcher stopped and started it again.');
        else $('errorLine').textContent = 'The boot hook ran, but ARC Guard could not confirm that the watcher started.';
        return afterStart;
      });
    });
  }
  function refresh(reportError) {
    return Promise.all([readFile(DATA + '/status.json'), readRuntimeState()]).then(function (values) {
      var state = values[1];
      showStatus(values[0], state);
      if (!state.hookInstalled) $('hookStatus').textContent = 'Boot hook not detected. Install the boot service to start the watcher automatically.';
      else if (state.watcherRunning) $('hookStatus').textContent = 'Boot hook is installed and the watcher process is running.';
      else $('hookStatus').textContent = 'Boot hook is installed, but the watcher is not running.';
    }).catch(function (err) {
      $('serviceBadge').className = 'badge muted';
      $('serviceBadge').textContent = 'Root service unavailable';
      $('lastAction').textContent = 'Could not read watcher status';
      $('statusDetail').textContent = 'ARC Guard could not reach the Homebrew Channel root execution service.';
      $('hookStatus').textContent = 'Watcher state unavailable because the Homebrew Channel root service did not respond.';
      $('errorLine').textContent = 'Could not read ARC Guard status: ' + err.message;
      if (reportError) toast('Could not refresh: ' + err.message);
    });
  }
  function withBusy(fn, refreshAfter) {
    if (busy) return;
    setBusy(true); Promise.resolve().then(fn).then(function () { return refreshAfter === false ? null : refresh(); }).catch(function (err) {
      $('errorLine').textContent = err.message || String(err); toast('Action failed: ' + (err.message || err));
    }).finally(function () { setBusy(false); });
  }
  function save() {
    return saveSettings().then(function () { toast('Settings saved.'); });
  }
  function installHook() {
    return saveSettings().then(function () {
      var cmd = 'mkdir -p /var/lib/webosbrew/init.d ' +
        '&& chmod +x ' + escapeSh(APPDIR + '/boot.sh') + ' ' + escapeSh(APPDIR + '/bin/arcguard-watch.sh') + ' ' +
        '&& ' + stopWatcherCommand() + ' ' +
        '&& ln -sfn ' + escapeSh(APPDIR + '/boot.sh') + ' ' + escapeSh(HOOK) + ' ' +
        '&& ' + escapeSh(APPDIR + '/boot.sh');
      return rootExec(cmd);
    }).then(function () { toast('Boot hook installed. Watcher start requested.'); });
  }
  function removeHook() {
    return rootExec('rm -f ' + escapeSh(HOOK) + ' && ' + stopWatcherCommand() + '; printf %s ' + escapeSh('{"running":false,"enabled":false,"current":"unknown","target":"external_arc","lastAction":"Boot hook removed","lastError":"","lastCheck":0,"corrections":0,"pausedUntil":0}') + ' > ' + escapeSh(DATA + '/status.json')).then(function () {
      toast('Boot hook removed and watcher stop requested.');
    });
  }
  function queryCurrentOutput() {
    return rootExec("luna-send -n 1 -f luna://com.webos.service.apiadapter/audio/getSoundOutput '{}' ").then(function (out) {
      var text = String(out || '').trim();
      var response;
      try { response = JSON.parse(text); } catch (_) { throw new Error("Could not read the TV's current audio output. No change was sent to avoid disturbing the soundbar."); }
      if (!response || response.returnValue === false) {
        throw new Error('The TV did not confirm the current audio output. No change was sent to avoid disturbing the soundbar.');
      }
      var current = response.output || response.soundOutput;
      if (!current || current === 'unknown' || current === 'null') {
        throw new Error('The current audio output was not reported. No change was sent to avoid disturbing the soundbar.');
      }
      return current;
    });
  }
  function applyNow() {
    return saveSettings().then(function (settings) {
      return queryCurrentOutput().then(function (current) {
        if (current === settings.target) {
          toast('Already on ' + (labels[current] || current) + '. No change sent, to avoid interrupting ARC audio.');
          return { alreadySelected: true };
        }
        // When enforcement is enabled, place a one-shot guard before the request
        // so the background watcher cannot race it and send a duplicate request.
        var guard = 'current=' + current + '\ntarget=' + settings.target + '\n';
        var guardWrite = settings.enabled === '1'
          ? rootExec("printf %s '" + b64Ascii(guard) + "' | base64 -d > " + escapeSh(DATA + '/request-guard.env') + ' && chmod 600 ' + escapeSh(DATA + '/request-guard.env'))
          : Promise.resolve('');
        return guardWrite.then(function () {
          return rootExec("luna-send -n 1 -f luna://com.webos.service.apiadapter/audio/changeSoundOutput '{\"output\":\"" + settings.target + "\"}'");
        }).then(function (out) {
          var text = String(out || '').trim();
          if (text.indexOf('"returnValue":true') >= 0 || text.indexOf('"returnValue": true') >= 0) {
            toast('Change requested once. Duplicate automatic requests are suppressed until the reported output changes.');
            return { requested: true };
          }
          var detail = text || 'No response from the TV audio service.';
          try { var response = JSON.parse(text); detail = response.errorText || response.errorCode || text; } catch (_) {}
          return rootExec('rm -f ' + escapeSh(DATA + '/request-guard.env')).then(function () {
            throw new Error('webOS did not confirm the output change: ' + detail);
          });
        }).catch(function (err) {
          return rootExec('rm -f ' + escapeSh(DATA + '/request-guard.env')).then(function () { throw err; }, function () { throw err; });
        });
      });
    });
  }
  function pauseFor30() {
    var until = Math.floor(Date.now()/1000) + 1800;
    return saveSettings({pause_until: until}).then(function () { toast('Enforcement paused for 30 minutes.'); });
  }
  function resume() { return saveSettings({pause_until: 0}).then(function () { toast('Enforcement resumed.'); }); }
  function activateTab(tabName, moveFocus) {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('[role=tab][data-view]'));
    tabs.forEach(function (tab) {
      var selected = tab.getAttribute('data-view') === tabName;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
      var panel = $('page' + tab.getAttribute('data-view'));
      if (panel) { panel.hidden = !selected; panel.classList.toggle('active', selected); }
      if (selected && moveFocus) tab.focus();
    });
  }
  function init() {
    var recoveryPending = true;
    var recoveryCheckRunning = false;
    function tryRecoverWatcher(reportError) {
      if (recoveryCheckRunning) return Promise.resolve();
      recoveryCheckRunning = true;
      return recoverWatcherOnLaunch().then(function () {
        recoveryPending = false;
        return refresh();
      }).catch(function (err) {
        $('errorLine').textContent = 'Could not check or start the watcher: ' + err.message;
        if (reportError) toast('ARC Guard could not check the watcher: ' + err.message);
        return refresh();
      }).finally(function () { recoveryCheckRunning = false; });
    }
    Array.prototype.slice.call(document.querySelectorAll('[role=tab][data-view]')).forEach(function (tab, index, tabs) {
      tab.addEventListener('click', function () { activateTab(tab.getAttribute('data-view'), false); });
      tab.addEventListener('keydown', function (event) {
        var next = index;
        var keyCode = event.keyCode || event.which;
        if (event.key === 'ArrowRight' || keyCode === 39) next = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft' || keyCode === 37) next = (index + tabs.length - 1) % tabs.length;
        else if (event.key === 'Home' || keyCode === 36) next = 0;
        else if (event.key === 'End' || keyCode === 35) next = tabs.length - 1;
        else return;
        event.preventDefault();
        activateTab(tabs[next].getAttribute('data-view'), true);
      });
    });
    bindPickers();
    document.addEventListener('keydown', handleDirectionalNavigation);
    $('refreshBtn').addEventListener('click', function () { withBusy(function () { return refresh(true); }, false); });
    $('saveBtn').addEventListener('click', function () { withBusy(save); });
    $('installBtn').addEventListener('click', function () { withBusy(installHook); });
    $('removeBtn').addEventListener('click', function () { withBusy(removeHook); });
    $('applyBtn').addEventListener('click', function () { withBusy(applyNow); });
    $('pauseBtn').addEventListener('click', function () { withBusy(pauseFor30); });
    $('resumeBtn').addEventListener('click', function () { withBusy(resume); });
    $('tabStatus').focus();
    readSettings().then(applySettings).catch(function (err) { toast('Could not read settings: ' + err.message); }).then(function () {
      return tryRecoverWatcher(true);
    });
    window.setInterval(function () {
      if (recoveryPending) tryRecoverWatcher(false);
      else refresh(false);
    }, 5000);
  }

  function handleDirectionalNavigation(event) {
    if (event.defaultPrevented) return;
    var code = event.keyCode || event.which;
    var direction = event.key === 'ArrowUp' || code === 38 ? 'up' :
      event.key === 'ArrowRight' || code === 39 ? 'right' :
      event.key === 'ArrowDown' || code === 40 ? 'down' :
      event.key === 'ArrowLeft' || code === 37 ? 'left' : '';
    if (!direction) return;
    var current = document.activeElement;
    var candidates = Array.prototype.slice.call(document.querySelectorAll('button, input, [tabindex]')).filter(function (node) {
      if (node.disabled || node.getAttribute('tabindex') === '-1' && node.getAttribute('role') !== 'tab') return false;
      for (var parent = node; parent; parent = parent.parentElement) if (parent.hidden) return false;
      return node.getClientRects().length > 0;
    });
    if (!current || current === document.body || candidates.indexOf(current) < 0) return;
    var rect = current.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var best = null;
    var bestScore = Infinity;
    candidates.forEach(function (candidate) {
      if (candidate === current) return;
      var box = candidate.getBoundingClientRect();
      var x = box.left + box.width / 2;
      var y = box.top + box.height / 2;
      var primary = direction === 'left' ? cx - x : direction === 'right' ? x - cx : direction === 'up' ? cy - y : y - cy;
      if (primary <= 0) return;
      var cross = direction === 'left' || direction === 'right' ? Math.abs(y - cy) : Math.abs(x - cx);
      var score = primary + cross * 1.5;
      if (score < bestScore) { best = candidate; bestScore = score; }
    });
    if (!best) return;
    event.preventDefault();
    best.focus();
    var view = best.closest ? best.closest('.views') : null;
    if (view) {
      var itemRect = best.getBoundingClientRect();
      var viewRect = view.getBoundingClientRect();
      if (itemRect.bottom > viewRect.bottom) view.scrollTop += itemRect.bottom - viewRect.bottom;
      else if (itemRect.top < viewRect.top) view.scrollTop -= viewRect.top - itemRect.top;
    }
  }
  document.addEventListener('DOMContentLoaded', init);
}());
