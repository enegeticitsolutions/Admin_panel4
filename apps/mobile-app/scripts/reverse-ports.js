const { exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function getAdbPath() {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
        const candidate = path.join(localAppData, 'Android', 'Sdk', 'platform-tools', 'adb.exe');
        if (fs.existsSync(candidate)) {
            return `"${candidate}"`;
        }
    }
    return 'adb';
}

const adb = getAdbPath();

function reversePorts() {
    try {
        const output = execSync(`${adb} devices`, { encoding: 'utf-8', timeout: 3000 });
        const hasDevice = output.split('\n').some(line => line.includes('\tdevice'));

        if (hasDevice) {
            execSync(`${adb} reverse tcp:8081 tcp:8081`, { timeout: 3000 });
            execSync(`${adb} reverse tcp:8001 tcp:8001`, { timeout: 3000 });
            console.log('⚡ [ADB Auto-Reverse] Successfully reversed ports 8081 (Metro) and 8001 (API)');
            return true;
        }
    } catch (e) {
        // Silently ignore if adb is not found or no device connected yet
    }
    return false;
}

// 1. Run immediately
const success = reversePorts();

// 2. If no device was ready yet, poll in background for 30s so when emulator finishes booting it auto-reverses
if (!success) {
    let attempts = 0;
    const interval = setInterval(() => {
        attempts++;
        if (reversePorts() || attempts >= 10) {
            clearInterval(interval);
        }
    }, 3000);
    // Unref so this background timer doesn't keep node from exiting if called in a chain
    if (interval.unref) interval.unref();
}
