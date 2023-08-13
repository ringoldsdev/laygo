export * from "./producers";

// TODO: set up CICD and deploy to npm - CICD should test for all major node versions
// TODO: create a consumer type that gets created asynchronously, has a process and end function
// TODO: create a transformer type that gets created asynchronously, has a process and end function
// consumers and transformers are quite similar but the major difference is that transformers can be chained and consumers can return a final result
// producers don't need a separate type because they are just a function that returns an async generator
// ideally none of those types would know that generators are involved but I currently don't know how to do that with producers
// producers are a part of the laygo core so if I would create a streams based laygo, i'd have to create new producers. consumers and transformers should be reuseable across all laygo implementations

// Once consume function is called, user can call that function multiple times and for each a new consumer is created
// It allows executing all consumers in parallel

// TODO: add a wrapper type
// TODO: refactor code so that transformers, wrappers, and consumers don't know generators are being used
// TODO: add a module function that works similarly to apply, but instead creates a new pipeline with the ability to wrap it and track errors
// TODO: make laygo a thenable object so that all consumers can be run at the same time
