// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./interfaces/IRoleManager.sol";

/**
 * @title RoleManager
 * @author Medicine Traceability MVP Team
 * @notice Manages administrative assignment and public verification of supply-chain roles.
 * @dev Enforces a single deployer admin model with strict role boundaries.
 */
contract RoleManager is IRoleManager {
    /// @notice Custom error thrown when a non-admin attempts to perform an administrative action.
    /// @param caller The address that attempted the unauthorized action.
    error UnauthorizedAdmin(address caller);

    /// @notice Custom error thrown when providing the zero address.
    error InvalidAccount();

    /// @notice Custom error thrown when attempting to reassign or set the Admin role.
    error CannotAssignAdminRole();

    /// @notice Custom error thrown when attempting to assign Role.None.
    error InvalidRole();

    /// @notice Emitted whenever a role is successfully assigned to an account.
    /// @param account The address receiving the role.
    /// @param role The role assigned to the address.
    event RoleAssigned(address indexed account, Role indexed role);

    /// @notice Address of the system administrator (set to deployer at construction).
    address public immutable override admin;

    /// @dev Internal mapping of addresses to assigned roles.
    mapping(address => Role) private _roles;

    /// @notice Initializes the contract and sets the deployer as the sole administrator.
    constructor() {
        admin = msg.sender;
        _roles[msg.sender] = Role.Admin;
        emit RoleAssigned(msg.sender, Role.Admin);
    }

    /// @notice Assigns a supply-chain role to an address.
    /// @dev Callable only by the admin. Cannot assign Admin or None.
    /// @param account The recipient address. Must not be address(0).
    /// @param role The role to grant (Manufacturer, Distributor, Pharmacy, or Patient).
    function registerRole(address account, Role role) external override {
        if (msg.sender != admin) {
            revert UnauthorizedAdmin(msg.sender);
        }
        if (account == address(0)) {
            revert InvalidAccount();
        }
        if (role == Role.Admin) {
            revert CannotAssignAdminRole();
        }
        if (role == Role.None) {
            revert InvalidRole();
        }

        _roles[account] = role;
        emit RoleAssigned(account, role);
    }

    /// @notice Returns the role assigned to a given account.
    /// @param account Address to look up.
    /// @return The assigned Role enum value (defaults to Role.None if unassigned).
    function getRole(address account) external view override returns (Role) {
        return _roles[account];
    }

    /// @notice Verifies whether an account holds a specific role.
    /// @param account Address to verify.
    /// @param role Role to check against.
    /// @return True if the account possesses the specified role, false otherwise.
    function hasRole(address account, Role role) external view override returns (bool) {
        return _roles[account] == role;
    }
}
