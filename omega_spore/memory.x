/* Minimal linker script for the omega_spore bare-metal smoke firmware.
   Targets the QEMU `mps2-an386` board: 4 MB ZBT SRAM at 0x21000000
   used as both code and data, vector table at 0x21000000. */

MEMORY
{
    FLASH : ORIGIN = 0x00000000, LENGTH = 4M
    RAM   : ORIGIN = 0x21000000, LENGTH = 4M
}

ENTRY(_start)

SECTIONS
{
    .vector_table 0x00000000 :
    {
        KEEP(*(.vector_table));
    } > FLASH

    .text :
    {
        *(.text .text.*);
    } > FLASH

    .rodata :
    {
        *(.rodata .rodata.*);
    } > FLASH

    .data :
    {
        *(.data .data.*);
    } > RAM AT > FLASH

    .bss :
    {
        *(.bss .bss.*);
        *(COMMON);
    } > RAM
}
