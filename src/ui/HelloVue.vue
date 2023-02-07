<template>
  <h2 id="test1">Hello,Developer!</h2>
  <Hello></Hello>
  <Hi :hi="hi"></Hi>
  <HiHi></HiHi>
  <div id="lalala">{{  age  }}</div>
  <div id="obsidianManagerChartContainer" style="position: relative;">
    <canvas id="obsidianManagerChart"></canvas>
  </div>
</template>

<script setup lang="tsx">

import Hello from "./Hello";
import Hi from "./Hi.vue";
import { onMounted, toRefs, ref } from "vue";
import Chart from 'chart.js/auto';

const props = defineProps<{
  age: string;
  getData: Function;
}>()

let hi = ref("");
let HiHi = () => (<h1><Hello></Hello></h1>)
const { age, getData } = toRefs(props);

onMounted(async () => {
  
  const history = await getData.value()
  console.log(history);
  
  var data = {
  labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"],
  datasets: [{
    label: "Dataset #1",
    backgroundColor: "rgba(255,99,132,0.2)",
    borderColor: "rgba(255,99,132,1)",
    borderWidth: 2,
    hoverBackgroundColor: "rgba(255,99,132,0.4)",
    hoverBorderColor: "rgba(255,99,132,1)",
    data: [65, 59, 20, 81, 56, 55, 40],
  }]
};

var options = {
  maintainAspectRatio: false,
  scales: {
    y: {
      stacked: true,
      grid: {
        display: true,
        color: "rgba(255,99,132,0.2)"
      }
    },
    x: {
      grid: {
        display: false
      }
    }
  }
};

new Chart('obsidianManagerChart', {
  type: 'bar',
  options: options,
  data: data
});

})

</script>


<style lang="css">
h2 {
  color: lightcoral;
  background: yellow;
}
#test1 h2 {
  color: green!important;
  background-color: blue;
}
</style>
