import neo4j, { Driver } from 'neo4j-driver';

const URI = process.env.NEO4J_URI!;
const USER = process.env.NEO4J_USER!;
const PASSWORD = process.env.NEO4J_PASSWORD!;

if (!URI || !USER || !PASSWORD) {
  throw new Error('Missing Neo4j environment variables: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD');
}

// Singleton driver — reused across requests in the same server process
let driver: Driver;

function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));
  }
  return driver;
}

export default getDriver;
