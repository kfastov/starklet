
#[starknet::interface]
pub trait IStarkletAccount<TContractState> {
    // TODO
}

#[starknet::contract(account)]
mod YourContract {
    use starknet::{get_tx_info};
    use openzeppelin_account::AccountComponent;
    use openzeppelin_introspection::src5::SRC5Component;
    use openzeppelin_access::ownable::OwnableComponent;
    use super::{IStarkletAccount};

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: AccountComponent, storage: account, event: AccountEvent);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;


    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        AccountEvent: AccountComponent::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
    }

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        account: AccountComponent::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
    }

    #[constructor]
    fn constructor(ref self: ContractState, public_key: felt252) {
        // TODO get owner via parameter
        // self.ownable.initializer(owner);
        // now just take the owner from the tx initiator
        let tx_info = get_tx_info();
        let sender = tx_info.account_contract_address;
        self.ownable.initializer(sender);
    }

    // Account Mixin
    #[abi(embed_v0)]
    pub(crate) impl AccountMixinImpl =
        AccountComponent::AccountMixinImpl<ContractState>;
    impl AccountInternalImpl = AccountComponent::InternalImpl<ContractState>;

    #[abi(embed_v0)]
    impl StarkletAccountImpl of IStarkletAccount<ContractState> {
        // TODO
    }
}
