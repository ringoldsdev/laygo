export * from "./producers";

// TODO: set up CICD and deploy to npm - CICD should test for all major node versions
// TODO: create a consumer type that gets created asynchronously, has a process and end function

// TODO: create a transformer type that gets created asynchronously, has a process and end function

// TODO: implement multiple emit support in the reduce function

// TODO: implement a buffer function that accumulates data from upstream and emits it downstream
// TODO: add another property to all functions - context. Context should be fully extendable and it should be type safe by default. Every time context changes get made, they should get reflected in downstream functions
// TODO: implement parallel function that requires an array of items so that it can take all items and run them in parallel. All responses get returned as an array or as they finish. Settings can be changed as needed
