const PRESSURE_POINTS = {
  // Left foot, plantar view (sole up), toes top.
  // Inner (medial) = right of screen; outer (lateral) = left of screen.
  // SVG viewBox: 0 0 200 400. Coordinates matched to anatomical foot path.
  P1: { id:'P1', name:'Toe-1 Tip', label:'엄지 끝',    defaultDirection:'positive', svgX:152, svgY:26  }, // big-toe tip
  P2: { id:'P2', name:'Met-1',     label:'엄지 뿌리',  defaultDirection:'positive', svgX:150, svgY:108 }, // 1st metatarsal head (inner ball)
  P3: { id:'P3', name:'Met-5',     label:'소지 뿌리',  defaultDirection:'positive', svgX:62,  svgY:102 }, // 5th metatarsal head (outer ball)
  P4: { id:'P4', name:'Arch',      label:'아치',       defaultDirection:'negative', svgX:148, svgY:224 }, // medial arch (inner side, hollow)
  P5: { id:'P5', name:'Heel-L',    label:'뒷꿈치 내측', defaultDirection:'negative', svgX:132, svgY:326 }, // inner heel pad
  P6: { id:'P6', name:'Heel',      label:'뒷꿈치 중앙', defaultDirection:'positive', svgX:98,  svgY:352 }, // center heel pad
  P7: { id:'P7', name:'Heel-M',    label:'뒷꿈치 외측', defaultDirection:'positive', svgX:64,  svgY:326 }, // outer heel pad
};

const POINT_IDS = ['P1','P2','P3','P4','P5','P6','P7'];

const DRILL_TYPES = {
  static: { label:'Static', color:'#5588cc' },
  gait:   { label:'Gait',   color:'#cc8844' },
  custom: { label:'Custom', color:'#8855cc' },
};

// Gait phase sequence: each array is a group that must activate in order
const GAIT_SEQUENCE = [
  ['P5','P6','P7'],  // phase 0: Heel
  ['P2','P3'],       // phase 1: Met
  ['P1'],            // phase 2: Toe-1
];

const BLE_UART = {
  service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  tx:      '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  rx:      '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
};

const MAX_SENSOR_VAL  = 1023;
const GAIT_ACTIVE_THR = 80;   // raw value above which a point is considered "active" in gait check
const REQUIRED_POINTS = 4;    // drills always use exactly 4 active points
