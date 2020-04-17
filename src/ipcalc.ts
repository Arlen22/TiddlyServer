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

/* In some versions of JavaScript subnet calculators they use bitwise operations to shift the values left. 
Unfortunately JavaScript converts to a 32-bit signed integer when you mess with bits, which leaves you with 
the sign + 31 bits. For the first byte this means converting back to an integer results in a negative value 
for values 128 and higher since the leftmost bit, the sign, becomes 1. Using the 64-bit float allows us to 
display the integer value to the user. */
/* dotted-quad IP to integer */
export function IPv4_dotquadA_to_intA(strbits) {
  var split = strbits.split('.', 4)
  var myInt =
    parseFloat((split[0] * 16777216) as any) /* 2^24 */ +
    parseFloat((split[1] * 65536) as any) /* 2^16 */ +
    parseFloat((split[2] * 256) as any) /* 2^8  */ +
    parseFloat(split[3])
  return myInt
}

/* integer IP to binary string representation */
export function IPv4_intA_to_binstrA(strnum) {
  var numStr = strnum.toString(2) /* Initialize return value as string */
  var numZeros = 32 - numStr.length /* Calculate no. of zeros */
  if (numZeros > 0) {
    for (var i = 1; i <= numZeros; i++) {
      numStr = '0' + numStr
    }
  }
  return numStr
}

/* convert # of bits to a string representation of the binary value */
export function IPv4_bitsNM_to_binstrNM(bitsNM) {
  var bitString = ''
  var numberOfOnes = bitsNM
  while (numberOfOnes--) bitString += '1' /* fill in ones */
  let numberOfZeros = 32 - bitsNM
  while (numberOfZeros--) bitString += '0' /* pad remaining with zeros */
  return bitString
}

/* The IPv4_Calc_* functions operate on string representations of the binary value because I don't trust JavaScript's sign + 31-bit bitwise functions. */
/* logical AND between address & netmask */
export function IPv4_Calc_netaddrBinStr(addressBinStr, netmaskBinStr) {
  var netaddressBinStr = ''
  var aBit = 0
  var nmBit = 0
  for (let pos = 0; pos < 32; pos++) {
    aBit = addressBinStr.substr(pos, 1)
    nmBit = netmaskBinStr.substr(pos, 1)
    if (aBit == nmBit) {
      netaddressBinStr += aBit.toString()
    } else {
      netaddressBinStr += '0'
    }
  }
  return netaddressBinStr
}
