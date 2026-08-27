class Human{
    //porperties 
    age = 13; //public
    wt=80; //public
    ht=180;//public
    #paaswoord = 911; //private (can only be accessed in the class and used by calling the function that is in the class)
    //behavior
    walking(){
        console.log("chal raha hu bc")
    }
    running(){
        console.log("now i am running")
    }
    
}
let obj = new Human;
console.log(obj.age)
console.log(obj.walking);
console.log(obj.running);
obj.running();
obj.walking();
