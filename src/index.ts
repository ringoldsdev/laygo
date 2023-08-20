export * from "./producers";

// TODO: set up CICD and deploy to npm - CICD should test for all major node versions
// TODO: create a consumer type that gets created asynchronously, has a process and end function

// TODO: implement a scan function that works like reduce but emits values at will using the emit function. It should also support done function so nothing would get processed
// Mindblow - every transformer is just a reduce function with fancy types and more levers

// TODO: create a transformer type that gets created asynchronously, has a process and end function
// TODO: implement all possible functions as the scan function
