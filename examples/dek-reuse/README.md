# Example of reusing a DEK to encrypt multiple data items

This is a simple example to demonstrate how you can use ironnode to encrypt a number of separate
data items using the same key, without requiring a call into ironnode (and corresponding inter-
action with IronCore's service) for each data item.

The example generates a random DEK and uses it to independently encrypt several blocks of data
(each of which is generated randomly). Each data block is written to a file "dataFile{num}.txt",
and its encrypted counterpart is written to "dataFile{num}.enc".

The encrypted DEK, or EDEK, is written to the file "edek".

The example then reads the "edek" file, uses ironnode to decrypt the contents, and checks the 
DEK by decrypting one of the ".enc" files and comparing the data to contents of the unencrypted
counterpart.

It then generates a new block of random data, writes it, and uses the DEK to encrypt it.
