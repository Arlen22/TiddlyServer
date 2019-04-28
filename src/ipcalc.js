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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXBjYWxjLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiaXBjYWxjLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7OztFQWFFOztBQUdGLFNBQWdCLFlBQVksQ0FBRSxjQUFjLEVBQUUsV0FBVztJQUN4RCxJQUFJLEtBQUssR0FBRyxjQUFjLENBQUMsS0FBSyxDQUFFLEdBQUcsRUFBRSxDQUFDLENBQUUsQ0FBQztJQUMzQyxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFFLEdBQUcsRUFBRSxRQUFRLENBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMseUNBQXlDO0lBQ3pHLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUUsR0FBRyxFQUFFLFFBQVEsQ0FBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUUsQ0FBQyxDQUFDLENBQUM7SUFDL0QsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBRSxHQUFHLEVBQUUsUUFBUSxDQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBRSxDQUFDLENBQUMsQ0FBQztJQUMvRCxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFFLEdBQUcsRUFBRSxRQUFRLENBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFFLENBQUMsQ0FBQyxDQUFDO0lBQy9ELElBQUksS0FBSyxDQUFFLEtBQUssQ0FBRSxFQUFFO1FBQUUsS0FBSyxHQUFHLENBQUMsQ0FBQztLQUFFLENBQUMsd0JBQXdCO0lBQzNELElBQUksS0FBSyxDQUFFLEtBQUssQ0FBRSxFQUFFO1FBQUUsS0FBSyxHQUFHLENBQUMsQ0FBQztLQUFFO0lBQ2xDLElBQUksS0FBSyxDQUFFLEtBQUssQ0FBRSxFQUFFO1FBQUUsS0FBSyxHQUFHLENBQUMsQ0FBQztLQUFFO0lBQ2xDLElBQUksS0FBSyxDQUFFLEtBQUssQ0FBRSxFQUFFO1FBQUUsS0FBSyxHQUFHLENBQUMsQ0FBQztLQUFFO0lBQ2xDLGNBQWMsR0FBRyxDQUFFLEtBQUssR0FBRSxHQUFHLEdBQUUsS0FBSyxHQUFFLEdBQUcsR0FBRSxLQUFLLEdBQUUsR0FBRyxHQUFFLEtBQUssQ0FBRSxDQUFDO0lBRS9ELElBQUksQ0FBQyxjQUFjLEdBQUcsY0FBYyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ2hELElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBRSxFQUFFLEVBQUUsUUFBUSxDQUFFLFdBQVcsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLHdDQUF3QztJQUVqSCxJQUFJLENBQUMsY0FBYyxHQUFHLHFCQUFxQixDQUFFLElBQUksQ0FBQyxjQUFjLENBQUUsQ0FBQztJQUNwRSx1RUFBdUU7SUFDdEUsSUFBSSxDQUFDLGFBQWEsR0FBSSxvQkFBb0IsQ0FBRSxJQUFJLENBQUMsY0FBYyxDQUFFLENBQUM7SUFFbEUsSUFBSSxDQUFDLGFBQWEsR0FBSSx1QkFBdUIsQ0FBRSxJQUFJLENBQUMsV0FBVyxDQUFFLENBQUM7SUFDbEUsSUFBSSxDQUFDLGNBQWMsR0FBRyxvQkFBb0IsQ0FBRSxJQUFJLENBQUMsYUFBYSxDQUFFLENBQUM7SUFDakUsSUFBSSxDQUFDLGNBQWMsR0FBSSxxQkFBcUIsQ0FBRSxJQUFJLENBQUMsY0FBYyxDQUFFLENBQUM7SUFFcEUsSUFBSSxDQUFDLGdCQUFnQixHQUFHLHVCQUF1QixDQUFFLElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBRSxDQUFDO0lBQzFGLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxvQkFBb0IsQ0FBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUUsQ0FBQztJQUN2RSxJQUFJLENBQUMsaUJBQWlCLEdBQUkscUJBQXFCLENBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFFLENBQUM7SUFFMUUsSUFBSSxDQUFDLGNBQWMsR0FBRyx3QkFBd0IsQ0FBRSxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUUsQ0FBQztJQUN6RixJQUFJLENBQUMsZUFBZSxHQUFHLG9CQUFvQixDQUFFLElBQUksQ0FBQyxjQUFjLENBQUUsQ0FBQztJQUNuRSxJQUFJLENBQUMsZUFBZSxHQUFJLHFCQUFxQixDQUFFLElBQUksQ0FBQyxlQUFlLENBQUUsQ0FBQztBQUN2RSxDQUFDO0FBOUJELG9DQThCQztBQUVEOzs7O3lDQUl5QztBQUN6QywrQkFBK0I7QUFDL0IsU0FBZ0IscUJBQXFCLENBQUUsT0FBTztJQUM3QyxJQUFJLEtBQUssR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFFLEdBQUcsRUFBRSxDQUFDLENBQUUsQ0FBQztJQUNwQyxJQUFJLEtBQUssR0FBRyxDQUNYLFVBQVUsQ0FBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBZSxDQUFFLENBQUMsVUFBVTtVQUNoRCxVQUFVLENBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQVksQ0FBRSxDQUFFLFVBQVU7VUFDakQsVUFBVSxDQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFVLENBQUUsQ0FBRSxVQUFVO1VBQy9DLFVBQVUsQ0FBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUUsQ0FDekIsQ0FBQztJQUNGLE9BQU8sS0FBSyxDQUFDO0FBQ2QsQ0FBQztBQVRELHNEQVNDO0FBRUQsK0JBQStCO0FBQy9CLFNBQWdCLHFCQUFxQixDQUFFLE1BQU07SUFDNUMsSUFBSSxLQUFLLEdBQUcsQ0FBRSxNQUFNLEtBQUssRUFBRSxDQUFFLENBQUM7SUFDOUIsSUFBSSxLQUFLLEdBQUcsQ0FBRSxNQUFNLEtBQUssRUFBRSxDQUFFLEdBQUcsR0FBRyxDQUFDO0lBQ3BDLElBQUksS0FBSyxHQUFHLENBQUUsTUFBTSxLQUFNLENBQUMsQ0FBRSxHQUFHLEdBQUcsQ0FBQztJQUNwQyxJQUFJLEtBQUssR0FBRyxNQUFNLEdBQUcsR0FBRyxDQUFDO0lBQ3pCLE9BQU8sQ0FBRSxLQUFLLEdBQUcsR0FBRyxHQUFHLEtBQUssR0FBRyxHQUFHLEdBQUcsS0FBSyxHQUFHLEdBQUcsR0FBRyxLQUFLLENBQUUsQ0FBQztBQUM1RCxDQUFDO0FBTkQsc0RBTUM7QUFFRCxnREFBZ0Q7QUFDaEQsU0FBZ0Isb0JBQW9CLENBQUUsTUFBTTtJQUMzQyxJQUFJLE1BQU0sR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFFLENBQUMsQ0FBRSxDQUFDLENBQUMsdUNBQXVDO0lBQzFFLElBQUksUUFBUSxHQUFHLEVBQUUsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsNEJBQTRCO0lBQy9ELElBQUksUUFBUSxHQUFHLENBQUMsRUFBRTtRQUFFLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxRQUFRLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFBRSxNQUFNLEdBQUcsR0FBRyxHQUFHLE1BQU0sQ0FBQTtTQUFFO0tBQUU7SUFDbkYsT0FBTyxNQUFNLENBQUM7QUFDZixDQUFDO0FBTEQsb0RBS0M7QUFFRCxnREFBZ0Q7QUFDaEQsU0FBZ0Isb0JBQW9CLENBQUUsTUFBTTtJQUMzQyxPQUFPLFFBQVEsQ0FBRSxNQUFNLEVBQUUsQ0FBQyxDQUFFLENBQUM7QUFDOUIsQ0FBQztBQUZELG9EQUVDO0FBRUQsc0VBQXNFO0FBQ3RFLFNBQWdCLHVCQUF1QixDQUFFLE1BQU07SUFDOUMsSUFBSSxTQUFTLEdBQUcsRUFBRSxDQUFDO0lBQ25CLElBQUksWUFBWSxHQUFHLE1BQU0sQ0FBQztJQUMxQixPQUFPLFlBQVksRUFBRTtRQUFHLFNBQVMsSUFBSSxHQUFHLENBQUMsQ0FBQyxrQkFBa0I7SUFDNUQsSUFBSSxhQUFhLEdBQUcsRUFBRSxHQUFHLE1BQU0sQ0FBQztJQUNoQyxPQUFPLGFBQWEsRUFBRTtRQUFHLFNBQVMsSUFBSSxHQUFHLENBQUMsQ0FBQyw4QkFBOEI7SUFDekUsT0FBTyxTQUFTLENBQUM7QUFDbEIsQ0FBQztBQVBELDBEQU9DO0FBRUQseUpBQXlKO0FBQ3pKLDJDQUEyQztBQUMzQyxTQUFnQix1QkFBdUIsQ0FBRSxhQUFhLEVBQUUsYUFBYTtJQUNwRSxJQUFJLGdCQUFnQixHQUFHLEVBQUUsQ0FBQztJQUMxQixJQUFJLElBQUksR0FBRyxDQUFDLENBQUM7SUFBQyxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUM7SUFDNUIsS0FBSyxJQUFJLEdBQUcsR0FBRyxDQUFDLEVBQUUsR0FBRyxHQUFHLEVBQUUsRUFBRSxHQUFHLEVBQUcsRUFBRztRQUNwQyxJQUFJLEdBQUcsYUFBYSxDQUFDLE1BQU0sQ0FBRSxHQUFHLEVBQUUsQ0FBQyxDQUFFLENBQUM7UUFDdEMsS0FBSyxHQUFHLGFBQWEsQ0FBQyxNQUFNLENBQUUsR0FBRyxFQUFFLENBQUMsQ0FBRSxDQUFDO1FBQ3ZDLElBQUksSUFBSSxJQUFJLEtBQUssRUFBRztZQUFFLGdCQUFnQixJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztTQUFFO2FBQ3hEO1lBQUUsZ0JBQWdCLElBQUksR0FBRyxDQUFDO1NBQUU7S0FDaEM7SUFDRCxPQUFPLGdCQUFnQixDQUFDO0FBQ3pCLENBQUM7QUFWRCwwREFVQztBQUVELDhDQUE4QztBQUM5QyxTQUFnQix3QkFBd0IsQ0FBRSxhQUFhLEVBQUUsYUFBYTtJQUNyRSxJQUFJLGNBQWMsR0FBRyxFQUFFLENBQUM7SUFDeEIsSUFBSSxJQUFJLEdBQUcsQ0FBQyxDQUFDO0lBQUMsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDO0lBQzVCLEtBQUssSUFBSSxHQUFHLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxFQUFFLEVBQUUsR0FBRyxFQUFHLEVBQUc7UUFDcEMsSUFBSSxHQUFHLFFBQVEsQ0FBRSxhQUFhLENBQUMsTUFBTSxDQUFFLEdBQUcsRUFBRSxDQUFDLENBQUUsQ0FBQyxDQUFDO1FBQ2pELEtBQUssR0FBRyxRQUFRLENBQUUsYUFBYSxDQUFDLE1BQU0sQ0FBRSxHQUFHLEVBQUUsQ0FBQyxDQUFFLENBQUMsQ0FBQztRQUVsRCxJQUFJLEtBQUssRUFBRztZQUFFLEtBQUssR0FBRyxDQUFDLENBQUM7U0FBRSxDQUFDLHVCQUF1QjthQUM5QztZQUFFLEtBQUssR0FBRyxDQUFDLENBQUM7U0FBRTtRQUVsQixJQUFJLElBQUksSUFBSSxLQUFLLEVBQUc7WUFBRSxjQUFjLElBQUksR0FBRyxDQUFBO1NBQUU7YUFDekM7WUFBRSxjQUFjLElBQUksR0FBRyxDQUFDO1NBQUU7S0FDOUI7SUFDRCxPQUFPLGNBQWMsQ0FBQztBQUN2QixDQUFDO0FBZEQsNERBY0M7QUFFRCwwR0FBMEc7QUFDMUcsU0FBZ0IsaUJBQWlCLENBQUUsSUFBSSxFQUFFLElBQUk7SUFDNUMsT0FBTyxDQUFFLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFFLENBQUMsRUFBRSxJQUFJLENBQUUsQ0FBRSxDQUFDO0FBQ3ZDLENBQUM7QUFGRCw4Q0FFQztBQUVELCtCQUErQjtBQUMvQixTQUFnQixrQkFBa0IsQ0FBRSxZQUFZO0lBQy9DLE9BQU8sQ0FBRSxZQUFZLENBQUMsTUFBTSxDQUFFLENBQUMsRUFBRSxDQUFDLENBQUUsR0FBRSxHQUFHLEdBQUUsWUFBWSxDQUFDLE1BQU0sQ0FBRSxDQUFDLEVBQUUsQ0FBQyxDQUFFLEdBQUUsR0FBRyxHQUFFLFlBQVksQ0FBQyxNQUFNLENBQUUsRUFBRSxFQUFFLENBQUMsQ0FBRSxHQUFFLEdBQUcsR0FBRSxZQUFZLENBQUMsTUFBTSxDQUFFLEVBQUUsRUFBRSxDQUFDLENBQUUsQ0FBRSxDQUFDO0FBQ2hKLENBQUM7QUFGRCxnREFFQyJ9