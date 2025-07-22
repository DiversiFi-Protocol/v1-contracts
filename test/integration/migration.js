const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const hre = require("hardhat");
const utils = require("../testModules/utils.js")
const deployAll = require("../deployAll.js");
const expect = require("chai").expect;

describe("migration integration tests", function() {
  describe("normal migration", function() {
    it("should succeed", async function() {

    })

    it("index token total supply should equal totalReservesScaled", async function() {

    })

    it("scaled reserves should match token balances", async function() {

    })

    it("any remaining equalization bounty from the old pool should be added to the feesCollected of the new pool", async function() {
      
    })
  })

  describe("", function() {
    it("", async function() {
      
    })
  })
})