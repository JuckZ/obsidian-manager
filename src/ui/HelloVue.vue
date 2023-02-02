<template>
  <h2>Hello,Developer!</h2>
  <Hello></Hello>
  <Hi :hi="hi"></Hi>
  <HiHi></HiHi>
</template>

<script setup lang="tsx">
import Hello from "./Hello";
import Hi from "./Hi.vue";
import { ref } from "vue";
import './main.css';
let hi = ref("");
let HiHi = () => (<h1><Hello></Hello></h1>)

</script>


<style>
h2 {
  color: lightcoral;
}
#test1 h2 {
  color: green!important;
  background-color: blue;
}

</style>
