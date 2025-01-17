// Creates StarkletAccount contracts
use starknet::{ContractAddress, ClassHash};

#[starknet::interface]
pub trait IStarkletFactory<TContractState> {
    fn deploy_starklet(ref self: TContractState, settings: StarkletDeploySettings);
    fn get_starklet_class_hash(ref self: TContractState) -> ClassHash;
    fn set_starklet_class_hash(ref self: TContractState, class_hash: ClassHash);
}

#[derive(Drop, Serde)]
struct StarkletDeploySettings {
    owner: ContractAddress,
    public_key: felt252,
    name: ByteArray,
    initial_balance: u256, // wei
    quote_period: u64, // seconds
    quote_limit: u256, // wei
    starklet_address_salt: felt252,
}

#[starknet::contract]
mod StarkletFactory {
    use OwnableComponent::InternalTrait;
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use starknet::{ContractAddress, ClassHash, contract_address_const};
    use core::num::traits::Zero;
    use starknet::{get_caller_address, syscalls::deploy_syscall};
    use super::{IStarkletFactory, StarkletDeploySettings, construct_starklet_calldata};

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    const ETH_CONTRACT_ADDRESS: felt252 =
        0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7;

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        StarkletDeployed: StarkletDeployed,
    }

    #[derive(Drop, starknet::Event)]
    struct StarkletDeployed {
        #[key]
        starklet_address: ContractAddress,
        #[key]
        starklet_owner: ContractAddress,
        starklet_name: ByteArray,
        starklet_public_key: felt252,
        starklet_initial_balance: u256, // wei
        starklet_quote_period: u64, // seconds
        starklet_quote_limit: u256 // wei
    }

    #[storage]
    struct Storage {
        starklet_class_hash: ClassHash,
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.ownable.initializer(owner);
    }

    #[abi(embed_v0)]
    impl StarkletFactoryImpl of IStarkletFactory<ContractState> {
        fn deploy_starklet(ref self: ContractState, settings: StarkletDeploySettings) {
            let starklet_class_hash = self.starklet_class_hash.read();

            // check that starklet_class_hash is set (non-zero)
            assert!(starklet_class_hash.is_non_zero(), "Starklet class hash not set");

            let starklet_calldata = construct_starklet_calldata(@settings);

            // invoke deploy_syscall
            let (starklet_address, _) = deploy_syscall(
                self.starklet_class_hash.read(),
                settings.starklet_address_salt,
                starklet_calldata,
                false,
            )
                .expect('Failed to deploy Starklet');
            // TODO: support STRK balance
            if settings.initial_balance > 0 {
                let eth_contract_address = contract_address_const::<ETH_CONTRACT_ADDRESS>();
                let eth_dispatcher = IERC20Dispatcher { contract_address: eth_contract_address };
                eth_dispatcher
                    .transfer_from(
                        get_caller_address(), starklet_address, settings.initial_balance,
                    );
            }
            self
                .emit(
                    StarkletDeployed {
                        starklet_address,
                        starklet_owner: settings.owner,
                        starklet_name: settings.name,
                        starklet_public_key: settings.public_key,
                        starklet_initial_balance: settings.initial_balance,
                        starklet_quote_period: settings.quote_period,
                        starklet_quote_limit: settings.quote_limit,
                    },
                );
        }

        fn get_starklet_class_hash(ref self: ContractState) -> ClassHash {
            self.starklet_class_hash.read()
        }

        fn set_starklet_class_hash(ref self: ContractState, class_hash: ClassHash) {
            self.ownable.assert_only_owner();
            self.starklet_class_hash.write(class_hash);
        }
    }
}

fn construct_starklet_calldata(settings: @StarkletDeploySettings) -> Span<felt252> {
    let mut calldata: Array<felt252> = array![];

    calldata.append(*settings.public_key);

    calldata.span()
}
