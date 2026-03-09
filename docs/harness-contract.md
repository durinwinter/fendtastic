# Harness Contract

Test harness behavior should remain independent of the selected southbound integration frontend.

In practice this means:

- Neuron is one valid frontend target
- Siemens Industrial Edge is another expected frontend target
- direct driver integrations such as Rust7 are also valid

Harness inputs and expected outputs should be written against runtime-node, binding, authority, and capability behavior rather than assuming that Neuron is always present.
