// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

contract Address {
    function _addressFrom(address _origin, uint256 _nonce) internal pure returns (address _address) {
        bytes memory _data;
        if (_nonce == 0x00) {
            _data = abi.encodePacked(bytes1(0xd6), bytes1(0x94), _origin, bytes1(0x80));
        } else if (_nonce <= 0x7f) {
            _data = abi.encodePacked(bytes1(0xd6), bytes1(0x94), _origin, uint8(_nonce));
        } else if (_nonce <= 0xff) {
            _data = abi.encodePacked(bytes1(0xd7), bytes1(0x94), _origin, bytes1(0x81), uint8(_nonce));
        } else if (_nonce <= 0xffff) {
            _data = abi.encodePacked(bytes1(0xd8), bytes1(0x94), _origin, bytes1(0x82), uint16(_nonce));
        } else if (_nonce <= 0xffffff) {
            _data = abi.encodePacked(bytes1(0xd9), bytes1(0x94), _origin, bytes1(0x83), uint24(_nonce));
        } else {
            _data = abi.encodePacked(bytes1(0xda), bytes1(0x94), _origin, bytes1(0x84), uint32(_nonce));
        }
        bytes32 _hash = keccak256(_data);
        assembly {
            mstore(0, _hash)
            _address := mload(0)
        }
    }

    function _getPredictedAddress(address _signer, uint256 _nonce) internal pure returns (address _predicted) {
        _predicted = _addressFrom(_signer, _nonce);
    }

    function _getSetOfPredictedAddresses(address _signer, uint256 _nonce, uint256 _set) internal pure returns (address[] memory _predicted) {
        _predicted = new address[](_set);
        for (uint256 i; i < _set; i++) {
            _predicted[i] = _getPredictedAddress(_signer, _nonce);
        }
    }
}
