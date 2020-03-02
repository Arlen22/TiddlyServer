"use strict";
/*
Copyright (c) 2010, Michael J. Skora
All rights reserved.
Source: http://www.umich.edu/~parsec/information/code/ip_calc.js.txt

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
* Redistributions of source code packaged with any other code to form a distributable product must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
* Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
* Neither the name of the author or other identifiers used by the author (such as nickname or avatar) may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
Object.defineProperty(exports, "__esModule", { value: true });
function IPv4_Address(addressDotQuad, netmaskBits) {
    var split = addressDotQuad.split('.', 4);
    var byte1 = Math.max(0, Math.min(255, parseInt(split[0]))); /* sanity check: valid values: = 0-255 */
    var byte2 = Math.max(0, Math.min(255, parseInt(split[1])));
    var byte3 = Math.max(0, Math.min(255, parseInt(split[2])));
    var byte4 = Math.max(0, Math.min(255, parseInt(split[3])));
    if (isNaN(byte1)) {
        byte1 = 0;
    } /* fix NaN situations */
    if (isNaN(byte2)) {
        byte2 = 0;
    }
    if (isNaN(byte3)) {
        byte3 = 0;
    }
    if (isNaN(byte4)) {
        byte4 = 0;
    }
    addressDotQuad = (byte1 + '.' + byte2 + '.' + byte3 + '.' + byte4);
    this.addressDotQuad = addressDotQuad.toString();
    this.netmaskBits = Math.max(0, Math.min(32, parseInt(netmaskBits))); /* sanity check: valid values: = 0-32 */
    this.addressInteger = IPv4_dotquadA_to_intA(this.addressDotQuad);
    //	this.addressDotQuad  = IPv4_intA_to_dotquadA( this.addressInteger );
    this.addressBinStr = IPv4_intA_to_binstrA(this.addressInteger);
    this.netmaskBinStr = IPv4_bitsNM_to_binstrNM(this.netmaskBits);
    this.netmaskInteger = IPv4_binstrA_to_intA(this.netmaskBinStr);
    this.netmaskDotQuad = IPv4_intA_to_dotquadA(this.netmaskInteger);
    this.netaddressBinStr = IPv4_Calc_netaddrBinStr(this.addressBinStr, this.netmaskBinStr);
    this.netaddressInteger = IPv4_binstrA_to_intA(this.netaddressBinStr);
    this.netaddressDotQuad = IPv4_intA_to_dotquadA(this.netaddressInteger);
    this.netbcastBinStr = IPv4_Calc_netbcastBinStr(this.addressBinStr, this.netmaskBinStr);
    this.netbcastInteger = IPv4_binstrA_to_intA(this.netbcastBinStr);
    this.netbcastDotQuad = IPv4_intA_to_dotquadA(this.netbcastInteger);
}
exports.IPv4_Address = IPv4_Address;
/* In some versions of JavaScript subnet calculators they use bitwise operations to shift the values left.
Unfortunately JavaScript converts to a 32-bit signed integer when you mess with bits, which leaves you with
the sign + 31 bits. For the first byte this means converting back to an integer results in a negative value
for values 128 and higher since the leftmost bit, the sign, becomes 1. Using the 64-bit float allows us to
display the integer value to the user. */
/* dotted-quad IP to integer */
function IPv4_dotquadA_to_intA(strbits) {
    var split = strbits.split('.', 4);
    var myInt = (parseFloat(split[0] * 16777216) /* 2^24 */
        + parseFloat(split[1] * 65536) /* 2^16 */
        + parseFloat(split[2] * 256) /* 2^8  */
        + parseFloat(split[3]));
    return myInt;
}
exports.IPv4_dotquadA_to_intA = IPv4_dotquadA_to_intA;
/* integer IP to dotted-quad */
function IPv4_intA_to_dotquadA(strnum) {
    var byte1 = (strnum >>> 24);
    var byte2 = (strnum >>> 16) & 255;
    var byte3 = (strnum >>> 8) & 255;
    var byte4 = strnum & 255;
    return (byte1 + '.' + byte2 + '.' + byte3 + '.' + byte4);
}
exports.IPv4_intA_to_dotquadA = IPv4_intA_to_dotquadA;
/* integer IP to binary string representation */
function IPv4_intA_to_binstrA(strnum) {
    var numStr = strnum.toString(2); /* Initialize return value as string */
    var numZeros = 32 - numStr.length; /* Calculate no. of zeros */
    if (numZeros > 0) {
        for (var i = 1; i <= numZeros; i++) {
            numStr = "0" + numStr;
        }
    }
    return numStr;
}
exports.IPv4_intA_to_binstrA = IPv4_intA_to_binstrA;
/* binary string IP to integer representation */
function IPv4_binstrA_to_intA(binstr) {
    return parseInt(binstr, 2);
}
exports.IPv4_binstrA_to_intA = IPv4_binstrA_to_intA;
/* convert # of bits to a string representation of the binary value */
function IPv4_bitsNM_to_binstrNM(bitsNM) {
    var bitString = '';
    var numberOfOnes = bitsNM;
    while (numberOfOnes--)
        bitString += '1'; /* fill in ones */
    let numberOfZeros = 32 - bitsNM;
    while (numberOfZeros--)
        bitString += '0'; /* pad remaining with zeros */
    return bitString;
}
exports.IPv4_bitsNM_to_binstrNM = IPv4_bitsNM_to_binstrNM;
/* The IPv4_Calc_* functions operate on string representations of the binary value because I don't trust JavaScript's sign + 31-bit bitwise functions. */
/* logical AND between address & netmask */
function IPv4_Calc_netaddrBinStr(addressBinStr, netmaskBinStr) {
    var netaddressBinStr = '';
    var aBit = 0;
    var nmBit = 0;
    for (let pos = 0; pos < 32; pos++) {
        aBit = addressBinStr.substr(pos, 1);
        nmBit = netmaskBinStr.substr(pos, 1);
        if (aBit == nmBit) {
            netaddressBinStr += aBit.toString();
        }
        else {
            netaddressBinStr += '0';
        }
    }
    return netaddressBinStr;
}
exports.IPv4_Calc_netaddrBinStr = IPv4_Calc_netaddrBinStr;
/* logical OR between address & NOT netmask */
function IPv4_Calc_netbcastBinStr(addressBinStr, netmaskBinStr) {
    var netbcastBinStr = '';
    var aBit = 0;
    var nmBit = 0;
    for (let pos = 0; pos < 32; pos++) {
        aBit = parseInt(addressBinStr.substr(pos, 1));
        nmBit = parseInt(netmaskBinStr.substr(pos, 1));
        if (nmBit) {
            nmBit = 0;
        } /* flip netmask bits */
        else {
            nmBit = 1;
        }
        if (aBit || nmBit) {
            netbcastBinStr += '1';
        }
        else {
            netbcastBinStr += '0';
        }
    }
    return netbcastBinStr;
}
exports.IPv4_Calc_netbcastBinStr = IPv4_Calc_netbcastBinStr;
/* included as an example alternative for converting 8-bit bytes to an integer in IPv4_dotquadA_to_intA */
function IPv4_BitShiftLeft(mask, bits) {
    return (mask * Math.pow(2, bits));
}
exports.IPv4_BitShiftLeft = IPv4_BitShiftLeft;
/* used for display purposes */
function IPv4_BinaryDotQuad(binaryString) {
    return (binaryString.substr(0, 8) + '.' + binaryString.substr(8, 8) + '.' + binaryString.substr(16, 8) + '.' + binaryString.substr(24, 8));
}
exports.IPv4_BinaryDotQuad = IPv4_BinaryDotQuad;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXBjYWxjLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2lwY2FsYy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7RUFhRTs7QUFHRixTQUFnQixZQUFZLENBQVksY0FBYyxFQUFFLFdBQVc7SUFDakUsSUFBSSxLQUFLLEdBQUcsY0FBYyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDekMsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLHlDQUF5QztJQUNyRyxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzNELElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDM0QsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMzRCxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsRUFBRTtRQUFFLEtBQUssR0FBRyxDQUFDLENBQUM7S0FBRSxDQUFDLHdCQUF3QjtJQUN6RCxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsRUFBRTtRQUFFLEtBQUssR0FBRyxDQUFD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