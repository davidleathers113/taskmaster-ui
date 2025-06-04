/**
 * Emergency Window Cleanup Script
 * 
 * Run this script to close all open Electron windows from your tests
 * Usage: node cleanup-windows.js
 */

const { BrowserWindow } = require('electron');

// Check if we're in an Electron environment
if (typeof BrowserWindow === 'undefined') {
  console.log('This script must be run in an Electron environment.');
  console.log('If you have Electron windows open from tests, they may have crashed.');
  console.log('You may need to kill the Electron processes manually.');
  
  // Try to find and kill Electron processes
  const { exec } = require('child_process');
  
  console.log('\nAttempting to kill Electron processes...');
  
  // Kill Electron processes on macOS/Linux
  exec('pkill -f "electron"', (error) => {
    if (error) {
      console.log('No Electron processes found or unable to kill them.');
    } else {
      console.log('Successfully killed Electron processes.');
    }
  });
  
  // Also try to kill specific test-related processes
  exec('pkill -f "vitest"', (error) => {
    if (!error) console.log('Killed vitest processes.');
  });
  
  exec('pkill -f "node.*test"', (error) => {
    if (!error) console.log('Killed test-related node processes.');
  });
  
} else {
  // We're in Electron, close all windows
  try {
    const windows = BrowserWindow.getAllWindows();
    console.log(`Found ${windows.length} open windows.`);
    
    windows.forEach((window, index) => {
      try {
        console.log(`Closing window ${index + 1}...`);
        window.destroy();
      } catch (err) {
        console.error(`Failed to close window ${index + 1}:`, err.message);
      }
    });
    
    console.log('All windows closed successfully.');
    
    // Quit the app
    const { app } = require('electron');
    if (app && app.quit) {
      app.quit();
    }
    
  } catch (error) {
    console.error('Error closing windows:', error);
  }
}

// Exit after a short delay
setTimeout(() => {
  process.exit(0);
}, 1000);