use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
use openzeppelin_utils::serde::SerializedAppend;
use snforge_std::{CheatSpan, ContractClassTrait, DeclareResultTrait, cheat_caller_address, declare};
use starknet::{ContractAddress, contract_address_const, class_hash::class_hash_const};
use contracts::StarkletFactory::{IStarkletFactoryDispatcher, IStarkletFactoryDispatcherTrait, StarkletDeploySettings};
use starknet::testing::set_contract_address;
use core::num::traits::Zero;

// Real contract address deployed on Sepolia
fn OWNER() -> ContractAddress {
    contract_address_const::<0x02dA5254690b46B9C4059C25366D1778839BE63C142d899F0306fd5c312A5918>()
}

const ETH_CONTRACT_ADDRESS: felt252 =
    0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7;

fn deploy_contract(name: ByteArray) -> ContractAddress {
    let contract_class = declare(name).unwrap().contract_class();
    let mut calldata = array![];
    calldata.append_serde(OWNER());
    let (contract_address, _) = contract_class.deploy(@calldata).unwrap();
    contract_address
}

// #[test]
// #[fork("SEPOLIA_LATEST")]
// fn test_transfer() {
//     let user = OWNER();
//     let eth_contract_address = contract_address_const::<ETH_CONTRACT_ADDRESS>();
//     let your_contract_address = deploy_contract("YourContract");

//     let your_contract_dispatcher = IYourContractDispatcher {
//         contract_address: your_contract_address,
//     };
//     let erc20_dispatcher = IERC20Dispatcher { contract_address: eth_contract_address };
//     let amount_to_transfer = 500;
//     cheat_caller_address(eth_contract_address, user, CheatSpan::TargetCalls(1));
//     erc20_dispatcher.approve(your_contract_address, amount_to_transfer);
//     let approved_amount = erc20_dispatcher.allowance(user, your_contract_address);
//     assert(approved_amount == amount_to_transfer, 'Not the right amount approved');

//     let new_greeting: ByteArray = "Learn Scaffold-Stark 2! :)";

//     cheat_caller_address(your_contract_address, user, CheatSpan::TargetCalls(1));
//     your_contract_dispatcher.set_greeting(new_greeting.clone(), 500); // we transfer 0 eth
//     assert(your_contract_dispatcher.greeting() == new_greeting, 'Should allow set new message');
// }

#[test]
fn test_starklet_factory_deployment() {
    // Deploy the factory
    let factory_address = deploy_contract("StarkletFactory");
    let factory = IStarkletFactoryDispatcher { contract_address: factory_address };
    
    // Check initial state
    let class_hash = factory.get_starklet_class_hash();
    assert(class_hash.is_zero(), 'Class hash should be zero');
    
    let owner = OWNER();
    let count = factory.get_user_starklets_count(owner);
    assert(count == 0, 'Initial count should be zero');
}

#[test]
fn test_set_starklet_class_hash() {
    // Deploy the factory
    let factory_address = deploy_contract("StarkletFactory");
    let factory = IStarkletFactoryDispatcher { contract_address: factory_address };
    
    // Set caller as owner
    let owner = OWNER();
    set_contract_address(owner);
    
    // Set a mock class hash
    let mock_class_hash = class_hash_const::<0x123>();
    factory.set_starklet_class_hash(mock_class_hash);
    
    // Verify the class hash was set
    let stored_hash = factory.get_starklet_class_hash();
    assert(stored_hash == mock_class_hash, 'Class hash not set correctly');
}

#[test]
fn test_deploy_starklet() {
    // Deploy the factory
    let factory_address = deploy_contract("StarkletFactory");
    let factory = IStarkletFactoryDispatcher { contract_address: factory_address };
    
    // Set caller as owner
    let owner = OWNER();
    set_contract_address(owner);
    
    // Set a mock class hash first
    let mock_class_hash = class_hash_const::<0x123>();
    factory.set_starklet_class_hash(mock_class_hash);
    
    // Prepare deployment settings
    let settings = StarkletDeploySettings {
        owner: owner,
        public_key: 0x456,
        name: "Test Starklet",
        initial_balance: 0,
        quote_period: 86400, // 1 day
        quote_limit: 1000000000000000000, // 1 ETH
        starklet_address_salt: 0x789,
    };
    
    // Deploy a starklet
    factory.deploy_starklet(settings);
    
    // Verify the starklet was tracked
    let count = factory.get_user_starklets_count(owner);
    assert(count == 1, 'Should have 1 starklet');
    
    // Get the deployed starklet address
    let starklet_address = factory.get_user_starklet_at(owner, 0);
    assert(!starklet_address.is_zero(), 'Should have valid address');
}

#[test]
#[should_panic(expected: ('Index out of bounds',))]
fn test_get_invalid_starklet_index() {
    let factory_address = deploy_contract("StarkletFactory");
    let factory = IStarkletFactoryDispatcher { contract_address: factory_address };
    
    let owner = OWNER();
    // Try to get a starklet at invalid index
    factory.get_user_starklet_at(owner, 0);
}

