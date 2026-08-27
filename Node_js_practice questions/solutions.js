// 1. Promises – Basic
const basicPromise = new Promise((resolve) => {
    setTimeout(() => {
        resolve("Data fetched successfully");
    }, 2000);
});
basicPromise.then(console.log);

// 2. Promise with Resolve/Reject
function checkAge(age) {
    return new Promise((resolve, reject) => {
        if (age >= 18) resolve("Eligible");
        else reject("Not Eligible");
    });
}
checkAge(20).then(console.log).catch(console.error);
checkAge(16).then(console.log).catch(console.error);

// 3. Promise Chaining
const loginUser = () => Promise.resolve("User logged in");
const getUserDetails = () => Promise.resolve("User details fetched");
const getUserOrders = () => Promise.resolve("User orders fetched");

loginUser()
    .then((res) => {
        console.log(res);
        return getUserDetails();
    })
    .then((res) => {
        console.log(res);
        return getUserOrders();
    })
    .then(console.log);

// 4. Promise.all()
const fetchUsers = new Promise(resolve => setTimeout(() => resolve("Users fetched"), 1000));
const fetchProducts = new Promise(resolve => setTimeout(() => resolve("Products fetched"), 2000));
const fetchOrders = new Promise(resolve => setTimeout(() => resolve("Orders fetched"), 1500));

Promise.all([fetchUsers, fetchProducts, fetchOrders])
    .then(results => {
        console.log("Promise.all results:", results);
    });

// 5. Convert Promise to async/await
function getData() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve("Data received");
        }, 2000);
    });
}
async function displayData() {
    const data = await getData();
    console.log(data);
}
displayData();

// 6. Async/Await Error Handling
async function getError() {
    throw new Error("Unable to fetch data");
}
async function handleError() {
    try {
        await getError();
    } catch (error) {
        console.log(error.message);
    }
}
handleError();

// 7. Sequential Async Operations
const getUser = () => new Promise(resolve => setTimeout(() => resolve("User"), 1000));
const getProfile = () => new Promise(resolve => setTimeout(() => resolve("Profile"), 1000));
const getPosts = () => new Promise(resolve => setTimeout(() => resolve("Posts"), 1000));

async function fetchAllSequentially() {
    console.log(await getUser());
    console.log(await getProfile());
    console.log(await getPosts());
}
fetchAllSequentially();

/*
8. Event Loop – Predict the Output
console.log("A");
setTimeout(() => {
    console.log("B");
}, 0);
Promise.resolve().then(() => {
    console.log("C");
});
console.log("D");

Output:
A
D
C
B
Why: "A" and "D" are synchronous and run immediately. Promise resolution "C" goes to the Microtask Queue, which is processed before the Macrotask Queue (setTimeout "B").
*/

/*
9. Event Loop – Explain Execution Order
console.log("Start");
setTimeout(() => {
    console.log("Timeout");
}, 0);
Promise.resolve().then(() => {
    console.log("Promise");
});
console.log("End");

Output:
Start
End
Promise
Timeout

Explanation:
- Call Stack: Executes synchronous code first ("Start", "End").
- Microtask Queue: Promises `.then()` are added here. It is checked immediately after the Call Stack is empty. ("Promise")
- Callback (Macrotask) Queue: setTimeout callbacks are added here. It is executed only after the Call Stack and Microtask Queue are both empty. ("Timeout")
*/

/*
10. Advanced – async/await + Event Loop
console.log("1");
setTimeout(() => {
    console.log("2");
}, 0);
async function test() {
    console.log("3");
    await Promise.resolve();
    console.log("4");
}
test();
Promise.resolve().then(() => {
    console.log("5");
});
console.log("6");

Output:
1
3
6
4
5
2

Explanation:
- Sync code runs: "1"
- setTimeout goes to Macrotask Queue.
- test() is called. "3" is sync and printed.
- await Promise.resolve() suspends the rest of test(), placing "4" in the Microtask Queue.
- Next Promise goes to Microtask Queue ("5").
- Sync code finishes with "6".
- Call Stack empty. Check Microtasks: "4" (from test resumption), then "5".
- Check Macrotasks: "2".
*/

/*
11. Challenge Question ⭐
console.log("Start");
setTimeout(() => {
    console.log("Timeout 1");
}, 0);
Promise.resolve().then(() => {
    console.log("Promise 1");
    setTimeout(() => {
        console.log("Timeout 2");
    }, 0);
});
async function demo() {
    console.log("Async 1");
    await Promise.resolve();
    console.log("Async 2");
}
demo();
console.log("End");

Output:
Start
Async 1
End
Promise 1
Async 2
Timeout 1
Timeout 2

Explanation:
1. Sync execution: "Start" is printed.
2. setTimeout 1 goes to Macrotask Queue.
3. Promise.resolve goes to Microtask Queue.
4. demo() is called, "Async 1" is printed (sync part of async function). The rest is paused by await and sent to Microtask Queue.
5. "End" is printed.
6. Sync code done. Check Microtasks:
   - First microtask is Promise 1. "Promise 1" printed, setTimeout 2 is queued to Macrotask Queue.
   - Second microtask is demo() resumption. "Async 2" printed.
7. Microtasks done. Check Macrotasks:
   - First macrotask is "Timeout 1".
   - Second macrotask is "Timeout 2".
   
Synchronous code: console.log("Start"), console.log("Async 1"), console.log("End")
Microtasks: Promise 1 callback, demo() continuation after await
Macrotasks: setTimeout 1 callback, setTimeout 2 callback
*/
