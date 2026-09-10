const { EventEmitter } = require('events');

// 1 & 2. Custom EventEmitter with DOM-like event payload
class DOMEmitter extends EventEmitter {
  // Simulate DOM dispatchEvent() by wrapping payload in an event object
  dispatchEvent(eventName, detail = {}) {
    const event = {
      type: eventName,
      target: this,
      detail,
      timestamp: Date.now()
    };
    this.emit(eventName, event);
  }
}

const emitter = new DOMEmitter();

// Register listeners (DOM-like event handler signature)
emitter.on('greet', (event) => {
  console.log(`[EVENT: ${event.type}] Hello, ${event.detail.name}! (Time: ${event.timestamp})`);
});

emitter.once('exit', (event) => {
  console.log(`[EVENT: ${event.type}] Terminating with status code ${event.detail.code}.`);
});

// 3. Event Loop Execution & Visualization
console.log('1. [SYNC] Main execution begins');

// Trigger synchronous event
emitter.dispatchEvent('greet', { name: 'Alice' });

// Timers Phase
setTimeout(() => {
  console.log('5. [EVENT LOOP] setTimeout callback (Timers Phase)');
}, 0);

// Check Phase
setImmediate(() => {
  console.log('6. [EVENT LOOP] setImmediate callback (Check Phase)');
});

// Microtask Queue (nextTick executes before any other asynchronous phases)
process.nextTick(() => {
  console.log('3. [MICROTASK] process.nextTick callback');
  // Trigger secondary event inside nextTick
  emitter.dispatchEvent('exit', { code: 0 });
});

// Microtask Queue (Promises execute after process.nextTick)
Promise.resolve().then(() => {
  console.log('4. [MICROTASK] Promise.then callback');
});

console.log('2. [SYNC] Main execution ends');




//command to input = node experiment.js