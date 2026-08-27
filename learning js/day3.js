const promiseOne = new Promise((resolve, reject)=>{
    console.log("promise taks 1");
    resolve ("promise passed by using resolve");
    let msg = true;
    if(!msg==true){
        console.log("messgae using promises failed");
    }else{

    }
});
promiseOne
.then((result)=>{
    console.log(result);
}).catch((error)=>{
    
})


async function test(){
    console.log("message:1");
    const response = await fetch("./student.json");
    console.log(response.status);
    return StereoPannerNode;
}
// //event loop 
// create one log
// sychronus Task
function test (){
    consol 
}