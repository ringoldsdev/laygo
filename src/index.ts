export * from "./producers";

// TODO: set up CICD and deploy to npm - CICD should test for all major node versions
// TODO: create a consumer type that gets created asynchronously, has a process and end function

// TODO: create a transformer type that gets created asynchronously, has a process and end function
// TODO: implement all possible functions as the scan function

// TODO: implement finish function in the reduce function that runs after everything has been processed
// TODO: implement multiple emit support in the reduce function

// It's very tempting to try and make reduce work as a consumer, but I think it's better to keep it as a transformer
// Better to create a new function that defines all consumers

// TODO: implement a generic map function that can emit and end processing
