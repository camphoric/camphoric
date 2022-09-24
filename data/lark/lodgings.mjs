//event = models.ForeignKey(Event, on_delete=models.CASCADE)
//parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True)
//name = models.CharField(max_length=255)
//children_title = models.CharField(
//    max_length=255, blank=True, default='',
//    help_text="title that goes on the dropdown field to select a child")
//# For non-leaf nodes, "capacity" and "reserved" should be set to zero.
//capacity = models.IntegerField(default=0, help_text="total camper capacity")
//reserved = models.IntegerField(default=0, help_text="number of reserved spots remaining")
//visible = models.BooleanField(default=False, help_text="true if visible on registration form")
//notes = models.TextField(blank=True, default='')

const twoBedCabins2 = [3, 8, 11, 13, 19, 24, 26, 31];

export default {
  root: {
      name: "Lodging",
      children_title: "Select a camp",
      visible: true,
  },

  // Add camps
  camp1: { parentKey: "root", name: "Camp 1", children_title: "Select a lodging type", visible: true },
  camp1_tent: { parentKey: "camp1", name: "Tent", children_title: "Select a tent area", visible: true },
  camp1_tent_area_A: {"parentKey":"camp1_tent","name":"Area A","visible":true,"reserved":15},
    camp1_tent_area_A_1: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A1"},
    camp1_tent_area_A_2: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A2"},
    camp1_tent_area_A_3: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A3"},
    camp1_tent_area_A_4: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A4"},
    camp1_tent_area_A_5: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A5"},
    camp1_tent_area_A_6: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A6"},
    camp1_tent_area_A_7: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A7"},
    camp1_tent_area_A_8: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A8"},
    camp1_tent_area_A_9: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A9"},
    camp1_tent_area_A_10: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A10"},
    camp1_tent_area_A_11: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A11"},
    camp1_tent_area_A_12: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A12"},
    camp1_tent_area_A_13: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A13"},
    camp1_tent_area_A_14: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A14"},
    camp1_tent_area_A_15: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A15"},
    camp1_tent_area_A_16: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A16"},
    camp1_tent_area_A_17: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A17"},
    camp1_tent_area_A_18: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A18"},
    camp1_tent_area_A_19: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A19"},
    camp1_tent_area_A_20: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A20"},
  camp1_tent_area_B: {"parentKey":"camp1_tent","name":"Area B","visible":true,"reserved":5},
    camp1_tent_area_B_1: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B1"},
    camp1_tent_area_B_2: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B2"},
    camp1_tent_area_B_3: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B3"},
    camp1_tent_area_B_4: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B4"},
    camp1_tent_area_B_5: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B5"},
    camp1_tent_area_B_6: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B6"},
    camp1_tent_area_B_7: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B7"},
    camp1_tent_area_B_8: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B8"},
    camp1_tent_area_B_9: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B9"},
    camp1_tent_area_B_10: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B10"},
    camp1_tent_area_B_11: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B11"},
    camp1_tent_area_B_12: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B12"},
    camp1_tent_area_B_13: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B13"},
    camp1_tent_area_B_14: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B14"},
    camp1_tent_area_B_15: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B15"},
    camp1_tent_area_B_16: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B16"},
    camp1_tent_area_B_17: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B17"},
    camp1_tent_area_B_18: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B18"},
    camp1_tent_area_B_19: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B19"},
    camp1_tent_area_B_20: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B20"},
    camp1_tent_area_B_21: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B21"},
    camp1_tent_area_B_22: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B22"},
    camp1_tent_area_B_23: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B23"},
    camp1_tent_area_B_24: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B24"},
    camp1_tent_area_B_25: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B25"},
    camp1_tent_area_B_26: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B26"},
    camp1_tent_area_B_27: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B27"},
    camp1_tent_area_B_28: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B28"},
    camp1_tent_area_B_29: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B29"},
    camp1_tent_area_B_30: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B30"},
    camp1_tent_area_B_31: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B31"},
    camp1_tent_area_B_32: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B32"},
    camp1_tent_area_B_33: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B33"},
    camp1_tent_area_B_34: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B34"},
    camp1_tent_area_B_35: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B35"},
    camp1_tent_area_B_36: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B36"},
    camp1_tent_area_B_37: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B37"},
    camp1_tent_area_B_38: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B38"},
    camp1_tent_area_B_39: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B39"},
    camp1_tent_area_B_40: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B40"},
    camp1_tent_area_B_41: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B41"},
    camp1_tent_area_B_42: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B42"},
    camp1_tent_area_B_43: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B43"},
    camp1_tent_area_B_44: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B44"},
    camp1_tent_area_B_45: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B45"},
    camp1_tent_area_B_46: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B46"},
    camp1_tent_area_B_47: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B47"},
    camp1_tent_area_B_48: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B48"},
    camp1_tent_area_B_49: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B49"},
    camp1_tent_area_B_50: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B50"},
    camp1_tent_area_B_51: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B51"},
    camp1_tent_area_B_52: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B52"},
    camp1_tent_area_B_53: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B53"},
    camp1_tent_area_B_54: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B54"},
    camp1_tent_area_B_55: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B55"},
    camp1_tent_area_B_56: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B56"},
    camp1_tent_area_B_57: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B57"},
    camp1_tent_area_B_58: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B58"},
    camp1_tent_area_B_59: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B59"},
    camp1_tent_area_B_60: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B60"},
  camp1_tent_area_C: {"parentKey":"camp1_tent","name":"Area C","visible":true,"reserved":5},
    camp1_tent_area_C_1: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C1"},
    camp1_tent_area_C_2: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C2"},
    camp1_tent_area_C_3: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C3"},
    camp1_tent_area_C_4: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C4"},
    camp1_tent_area_C_5: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C5"},
    camp1_tent_area_C_6: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C6"},
    camp1_tent_area_C_7: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C7"},
    camp1_tent_area_C_8: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C8"},
    camp1_tent_area_C_9: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C9"},
    camp1_tent_area_C_10: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C10"},
    camp1_tent_area_C_11: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C11"},
    camp1_tent_area_C_12: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C12"},
    camp1_tent_area_C_13: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C13"},
    camp1_tent_area_C_14: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C14"},
    camp1_tent_area_C_15: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C15"},
    camp1_tent_area_C_16: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C16"},
    camp1_tent_area_C_17: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C17"},
    camp1_tent_area_C_18: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C18"},
    camp1_tent_area_C_19: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C19"},
    camp1_tent_area_C_20: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C20"},
    camp1_tent_area_C_21: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C21"},
    camp1_tent_area_C_22: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C22"},
    camp1_tent_area_C_23: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C23"},
    camp1_tent_area_C_24: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C24"},
    camp1_tent_area_C_25: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C25"},

  camp1_rv: { parentKey: "camp1", name: "RV", visible: true, children_title: "Select your RV size" },
  camp1_rv_sm: {"parentKey":"camp1_rv","name":"RV under 15' long","visible":true,"reserved":10},
    camp1_rv_sm_1: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV1"},
    camp1_rv_sm_2: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV2"},
    camp1_rv_sm_3: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV3"},
    camp1_rv_sm_4: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV4"},
    camp1_rv_sm_5: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV5"},
    camp1_rv_sm_6: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV6"},
    camp1_rv_sm_7: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV7"},
    camp1_rv_sm_8: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV8"},
    camp1_rv_sm_9: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV9"},
    camp1_rv_sm_10: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV10"},
    camp1_rv_sm_11: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV11"},
    camp1_rv_sm_12: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV12"},
    camp1_rv_sm_13: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV13"},
    camp1_rv_sm_14: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV14"},
    camp1_rv_sm_15: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV15"},
    camp1_rv_sm_16: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV16"},
    camp1_rv_sm_17: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV17"},
    camp1_rv_sm_18: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV18"},
    camp1_rv_sm_19: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV19"},
    camp1_rv_sm_20: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV20"},
  camp1_rv_lg: {"parentKey":"camp1_rv","name":"RV 15'-20' long","visible":true,"reserved":4},
    camp1_rv_lg_1: {"parentKey":"camp1_rv_lg","capacity":1,"visible":false,"name":"Spot 1LRV1"},
    camp1_rv_lg_2: {"parentKey":"camp1_rv_lg","capacity":1,"visible":false,"name":"Spot 1LRV2"},
    camp1_rv_lg_3: {"parentKey":"camp1_rv_lg","capacity":1,"visible":false,"name":"Spot 1LRV3"},
    camp1_rv_lg_4: {"parentKey":"camp1_rv_lg","capacity":1,"visible":false,"name":"Spot 1LRV4"},
    camp1_rv_lg_5: {"parentKey":"camp1_rv_lg","capacity":1,"visible":false,"name":"Spot 1LRV5"},

  camp1_cabin: { parentKey: "camp1", name: "Cabin", visible: true, children_title: "Select your cabin preference" },

  ...Array.apply(null, Array(46)).map(function () {}).reduce(
      (acc, v, i) => {
          const cabinNum = i + 1;

          return {
              ...acc,
              [`camp1_cabin_${cabinNum}`]: {
                  parentKey: "camp1_cabin",
                  name: `Cabin ${cabinNum}`,
                  visible: false,
                  capacity: 4,
              },
          };
      },
      {},
  ),

  camp1_cabin_cooks: { parentKey: "camp1_cabin", name: "Cooks Cabin", visible: false, capacity: 20 },

  // camp 2
  camp2: { parentKey: "root", name: "Camp 2", children_title: "Select a lodging type", visible: true },
  camp2_tent: { parentKey: "camp2", name: "Tent", children_title: "Select a tent area", visible: true },

  camp2_tent_area_D: {"parentKey":"camp2_tent","name":"Area D","visible":true,"reserved":2},
    camp2_tent_area_D_1: {"parentKey":"camp2_tent_area_D","capacity":1,"visible":false,"name":"Spot D1"},
    camp2_tent_area_D_2: {"parentKey":"camp2_tent_area_D","capacity":1,"visible":false,"name":"Spot D2"},
    camp2_tent_area_D_3: {"parentKey":"camp2_tent_area_D","capacity":1,"visible":false,"name":"Spot D3"},
    camp2_tent_area_D_4: {"parentKey":"camp2_tent_area_D","capacity":1,"visible":false,"name":"Spot D4"},
    camp2_tent_area_D_5: {"parentKey":"camp2_tent_area_D","capacity":1,"visible":false,"name":"Spot D5"},
    camp2_tent_area_D_6: {"parentKey":"camp2_tent_area_D","capacity":1,"visible":false,"name":"Spot D6"},
    camp2_tent_area_D_7: {"parentKey":"camp2_tent_area_D","capacity":1,"visible":false,"name":"Spot D7"},
    camp2_tent_area_D_8: {"parentKey":"camp2_tent_area_D","capacity":1,"visible":false,"name":"Spot D8"},
    camp2_tent_area_D_9: {"parentKey":"camp2_tent_area_D","capacity":1,"visible":false,"name":"Spot D9"},
  camp2_tent_area_E: {"parentKey":"camp2_tent","name":"Area E","visible":true,"reserved":2},
    camp2_tent_area_E_1: {"parentKey":"camp2_tent_area_E","capacity":1,"visible":false,"name":"Spot E1"},
    camp2_tent_area_E_2: {"parentKey":"camp2_tent_area_E","capacity":1,"visible":false,"name":"Spot E2"},
    camp2_tent_area_E_3: {"parentKey":"camp2_tent_area_E","capacity":1,"visible":false,"name":"Spot E3"},
    camp2_tent_area_E_4: {"parentKey":"camp2_tent_area_E","capacity":1,"visible":false,"name":"Spot E4"},
    camp2_tent_area_E_5: {"parentKey":"camp2_tent_area_E","capacity":1,"visible":false,"name":"Spot E5"},
    camp2_tent_area_E_6: {"parentKey":"camp2_tent_area_E","capacity":1,"visible":false,"name":"Spot E6"},
    camp2_tent_area_E_7: {"parentKey":"camp2_tent_area_E","capacity":1,"visible":false,"name":"Spot E7"},
    camp2_tent_area_E_8: {"parentKey":"camp2_tent_area_E","capacity":1,"visible":false,"name":"Spot E8"},
    camp2_tent_area_E_9: {"parentKey":"camp2_tent_area_E","capacity":1,"visible":false,"name":"Spot E9"},
    camp2_tent_area_E_10: {"parentKey":"camp2_tent_area_E","capacity":1,"visible":false,"name":"Spot E10"},
  camp2_tent_area_F: {"parentKey":"camp2_tent","name":"Area F","visible":true,"reserved":2},
    camp2_tent_area_F_1: {"parentKey":"camp2_tent_area_F","capacity":1,"visible":false,"name":"Spot F1"},
    camp2_tent_area_F_2: {"parentKey":"camp2_tent_area_F","capacity":1,"visible":false,"name":"Spot F2"},
    camp2_tent_area_F_3: {"parentKey":"camp2_tent_area_F","capacity":1,"visible":false,"name":"Spot F3"},
    camp2_tent_area_F_4: {"parentKey":"camp2_tent_area_F","capacity":1,"visible":false,"name":"Spot F4"},
    camp2_tent_area_F_5: {"parentKey":"camp2_tent_area_F","capacity":1,"visible":false,"name":"Spot F5"},
    camp2_tent_area_F_6: {"parentKey":"camp2_tent_area_F","capacity":1,"visible":false,"name":"Spot F6"},
    camp2_tent_area_F_7: {"parentKey":"camp2_tent_area_F","capacity":1,"visible":false,"name":"Spot F7"},
    camp2_tent_area_F_8: {"parentKey":"camp2_tent_area_F","capacity":1,"visible":false,"name":"Spot F8"},
    camp2_tent_area_F_9: {"parentKey":"camp2_tent_area_F","capacity":1,"visible":false,"name":"Spot F9"},
    camp2_tent_area_F_10: {"parentKey":"camp2_tent_area_F","capacity":1,"visible":false,"name":"Spot F10"},
  camp2_tent_area_G: {"parentKey":"camp2_tent","name":"Area G","visible":true,"reserved":2,},
    camp2_tent_area_G_1: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G1"},
    camp2_tent_area_G_2: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G2"},
    camp2_tent_area_G_3: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G3"},
    camp2_tent_area_G_4: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G4"},
    camp2_tent_area_G_5: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G5"},
    camp2_tent_area_G_6: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G6"},
    camp2_tent_area_G_7: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G7"},
    camp2_tent_area_G_8: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G8"},
    camp2_tent_area_G_9: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G9"},
    camp2_tent_area_G_10: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G10"},
    camp2_tent_area_G_11: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G11"},
    camp2_tent_area_G_12: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G12"},
    camp2_tent_area_G_13: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G13"},
    camp2_tent_area_G_14: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G14"},
    camp2_tent_area_G_15: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G15"},
    camp2_tent_area_G_16: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G16"},
    camp2_tent_area_G_17: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G17"},
    camp2_tent_area_G_18: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G18"},
    camp2_tent_area_G_19: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G19"},
    camp2_tent_area_G_20: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G20"},
  camp2_tent_area_H: {"parentKey":"camp2_tent","name":"Area H","visible":true,"reserved":2,},
    camp2_tent_area_H_1: {"parentKey":"camp2_tent_area_H","capacity":1,"visible":false,"name":"Spot H1"},
    camp2_tent_area_H_2: {"parentKey":"camp2_tent_area_H","capacity":1,"visible":false,"name":"Spot H2"},
    camp2_tent_area_H_3: {"parentKey":"camp2_tent_area_H","capacity":1,"visible":false,"name":"Spot H3"},
    camp2_tent_area_H_4: {"parentKey":"camp2_tent_area_H","capacity":1,"visible":false,"name":"Spot H4"},
    camp2_tent_area_H_5: {"parentKey":"camp2_tent_area_H","capacity":1,"visible":false,"name":"Spot H5"},
    camp2_tent_area_H_6: {"parentKey":"camp2_tent_area_H","capacity":1,"visible":false,"name":"Spot H6"},
    camp2_tent_area_H_7: {"parentKey":"camp2_tent_area_H","capacity":1,"visible":false,"name":"Spot H7"},
    camp2_tent_area_H_8: {"parentKey":"camp2_tent_area_H","capacity":1,"visible":false,"name":"Spot H8"},
    camp2_tent_area_H_9: {"parentKey":"camp2_tent_area_H","capacity":1,"visible":false,"name":"Spot H9"},
    camp2_tent_area_H_10: {"parentKey":"camp2_tent_area_H","capacity":1,"visible":false,"name":"Spot H10"},

  camp2_rv: { parentKey: "camp2", name: "RV", visible: true, children_title: "Select your RV size" },
  camp2_rv_sm: {"parentKey":"camp2_rv","name":"RV under 15' long","visible":true,"reserved":10},
    camp2_rv_sm_1: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV1"},
    camp2_rv_sm_2: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV2"},
    camp2_rv_sm_3: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV3"},
    camp2_rv_sm_4: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV4"},
    camp2_rv_sm_5: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV5"},
    camp2_rv_sm_6: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV6"},
    camp2_rv_sm_7: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV7"},
    camp2_rv_sm_8: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV8"},
    camp2_rv_sm_9: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV9"},
    camp2_rv_sm_10: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV10"},
    camp2_rv_sm_11: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV11"},
    camp2_rv_sm_12: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV12"},
    camp2_rv_sm_13: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV13"},
    camp2_rv_sm_14: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV14"},
    camp2_rv_sm_15: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV15"},
    camp2_rv_sm_16: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV16"},
    camp2_rv_sm_17: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV17"},
    camp2_rv_sm_18: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV18"},
    camp2_rv_sm_19: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV19"},
    camp2_rv_sm_20: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV20"},
    camp2_rv_sm_21: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV21"},
    camp2_rv_sm_22: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV22"},
    camp2_rv_sm_23: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV23"},
    camp2_rv_sm_24: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV24"},
    camp2_rv_sm_25: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV25"},
    camp2_rv_sm_26: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV26"},
    camp2_rv_sm_27: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV27"},
    camp2_rv_sm_28: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV28"},
    camp2_rv_sm_29: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV29"},
    camp2_rv_sm_30: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV30"},
    camp2_rv_sm_31: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV31"},
    camp2_rv_sm_32: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV32"},
    camp2_rv_sm_33: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV33"},
    camp2_rv_sm_34: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV34"},
    camp2_rv_sm_35: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV35"},
    camp2_rv_sm_36: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV36"},
    camp2_rv_sm_37: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV37"},
    camp2_rv_sm_38: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV38"},
    camp2_rv_sm_39: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV39"},
    camp2_rv_sm_40: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV40"},
  camp2_rv_lg: {"parentKey":"camp2_rv","name":"RV 15'-20' long","visible":true,"reserved":5},
    camp2_rv_lg_1: {"parentKey":"camp2_rv_lg","capacity":1,"visible":false,"name":"Spot 2LRV1"},
    camp2_rv_lg_2: {"parentKey":"camp2_rv_lg","capacity":1,"visible":false,"name":"Spot 2LRV2"},
    camp2_rv_lg_3: {"parentKey":"camp2_rv_lg","capacity":1,"visible":false,"name":"Spot 2LRV3"},
    camp2_rv_lg_4: {"parentKey":"camp2_rv_lg","capacity":1,"visible":false,"name":"Spot 2LRV4"},
    camp2_rv_lg_5: {"parentKey":"camp2_rv_lg","capacity":1,"visible":false,"name":"Spot 2LRV5"},
    camp2_rv_lg_6: {"parentKey":"camp2_rv_lg","capacity":1,"visible":false,"name":"Spot 2LRV6"},
    camp2_rv_lg_7: {"parentKey":"camp2_rv_lg","capacity":1,"visible":false,"name":"Spot 2LRV7"},
    camp2_rv_lg_8: {"parentKey":"camp2_rv_lg","capacity":1,"visible":false,"name":"Spot 2LRV8"},
    camp2_rv_lg_9: {"parentKey":"camp2_rv_lg","capacity":1,"visible":false,"name":"Spot 2LRV9"},
    camp2_rv_lg_10: {"parentKey":"camp2_rv_lg","capacity":1,"visible":false,"name":"Spot 2LRV10"},
  camp2_rv_xl: {"parentKey":"camp2_rv","name":"RV over 20' long (call ahead)","visible":true,"reserved":3},
    camp2_rv_xl_1: {"parentKey":"camp2_rv_xl","capacity":1,"visible":false,"name":"Spot 2XLRV1"},
    camp2_rv_xl_2: {"parentKey":"camp2_rv_xl","capacity":1,"visible":false,"name":"Spot 2XLRV2"},
    camp2_rv_xl_3: {"parentKey":"camp2_rv_xl","capacity":1,"visible":false,"name":"Spot 2XLRV3"},
    camp2_rv_xl_4: {"parentKey":"camp2_rv_xl","capacity":1,"visible":false,"name":"Spot 2XLRV4"},
    camp2_rv_xl_5: {"parentKey":"camp2_rv_xl","capacity":1,"visible":false,"name":"Spot 2XLRV5"},

  camp2_cabin: { parentKey: "camp2", name: "Cabin", visible: true, children_title: "Select your cabin preference" },

  ...Array.apply(null, Array(32)).map(function () {}).reduce(
      (acc, v, i) => {
          const cabinNum = i + 1;
          let capacity = 4;

          // check for 2-bed cabins
          if (twoBedCabins2.includes(cabinNum)) {
              capacity = 2;
          }

          return {
              ...acc,
              [`camp2_cabin_${cabinNum}`]: {
                  parentKey: "camp2_cabin",
                  name: `Cabin ${cabinNum}`,
                  visible: false,
                  capacity,
              },
          };
      },
      {},
  ),

  camp2_cabin_GH: {
      parentKey: "camp2_cabin",
      name: "Gatehouse",
      visible: false,
      capacity: 4,
  },

  // camp 3
  camp3: { parentKey: "root", name: "Camp 3", children_title: "Select a lodging type", visible: true },
  camp3_tent: { parentKey: "camp3", name: "Tent", children_title: "Select a tent area", visible: true },

  camp3_tent_area_I: {"parentKey":"camp3_tent","name":"Area I","visible":true,"reserved":4,},
    camp3_tent_area_I_1: {"parentKey":"camp3_tent_area_I","capacity":1,"visible":false,"name":"Spot I1"},
    camp3_tent_area_I_2: {"parentKey":"camp3_tent_area_I","capacity":1,"visible":false,"name":"Spot I2"},
    camp3_tent_area_I_3: {"parentKey":"camp3_tent_area_I","capacity":1,"visible":false,"name":"Spot I3"},
    camp3_tent_area_I_4: {"parentKey":"camp3_tent_area_I","capacity":1,"visible":false,"name":"Spot I4"},
    camp3_tent_area_I_5: {"parentKey":"camp3_tent_area_I","capacity":1,"visible":false,"name":"Spot I5"},
  camp3_tent_area_J: {"parentKey":"camp3_tent","name":"Area J","visible":true,"reserved":2,},
    camp3_tent_area_J_1: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J1"},
    camp3_tent_area_J_2: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J2"},
    camp3_tent_area_J_3: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J3"},
    camp3_tent_area_J_4: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J4"},
    camp3_tent_area_J_5: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J5"},
    camp3_tent_area_J_6: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J6"},
    camp3_tent_area_J_7: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J7"},
    camp3_tent_area_J_8: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J8"},
    camp3_tent_area_J_9: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J9"},
    camp3_tent_area_J_10: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J10"},
    camp3_tent_area_J_11: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J11"},
    camp3_tent_area_J_12: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J12"},
    camp3_tent_area_J_13: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J13"},
    camp3_tent_area_J_14: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J14"},
    camp3_tent_area_J_15: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J15"},
    camp3_tent_area_J_16: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J16"},
    camp3_tent_area_J_17: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J17"},
    camp3_tent_area_J_18: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J18"},
    camp3_tent_area_J_19: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J19"},
    camp3_tent_area_J_20: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J20"},
  camp3_tent_area_K: {"parentKey":"camp3_tent","name":"Area K","visible":true,"reserved":2,},
    camp3_tent_area_K_1: {"parentKey":"camp3_tent_area_K","capacity":1,"visible":false,"name":"Spot K1"},
    camp3_tent_area_K_2: {"parentKey":"camp3_tent_area_K","capacity":1,"visible":false,"name":"Spot K2"},
    camp3_tent_area_K_3: {"parentKey":"camp3_tent_area_K","capacity":1,"visible":false,"name":"Spot K3"},
    camp3_tent_area_K_4: {"parentKey":"camp3_tent_area_K","capacity":1,"visible":false,"name":"Spot K4"},
    camp3_tent_area_K_5: {"parentKey":"camp3_tent_area_K","capacity":1,"visible":false,"name":"Spot K5"},
    camp3_tent_area_K_6: {"parentKey":"camp3_tent_area_K","capacity":1,"visible":false,"name":"Spot K6"},
    camp3_tent_area_K_7: {"parentKey":"camp3_tent_area_K","capacity":1,"visible":false,"name":"Spot K7"},
    camp3_tent_area_K_8: {"parentKey":"camp3_tent_area_K","capacity":1,"visible":false,"name":"Spot K8"},
    camp3_tent_area_K_9: {"parentKey":"camp3_tent_area_K","capacity":1,"visible":false,"name":"Spot K9"},
    camp3_tent_area_K_10: {"parentKey":"camp3_tent_area_K","capacity":1,"visible":false,"name":"Spot K10"},
  camp3_tent_area_L: {"parentKey":"camp3_tent","name":"Area L","visible":true,"reserved":2,},
    camp3_tent_area_L_1: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L1"},
    camp3_tent_area_L_2: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L2"},
    camp3_tent_area_L_3: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L3"},
    camp3_tent_area_L_4: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L4"},
    camp3_tent_area_L_5: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L5"},
    camp3_tent_area_L_6: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L6"},
    camp3_tent_area_L_7: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L7"},
    camp3_tent_area_L_8: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L8"},
    camp3_tent_area_L_9: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L9"},
    camp3_tent_area_L_10: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L10"},
    camp3_tent_area_L_11: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L11"},
    camp3_tent_area_L_12: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L12"},
    camp3_tent_area_L_13: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L13"},
    camp3_tent_area_L_14: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L14"},
    camp3_tent_area_L_15: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L15"},
    camp3_tent_area_L_16: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L16"},
    camp3_tent_area_L_17: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L17"},
    camp3_tent_area_L_18: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L18"},
    camp3_tent_area_L_19: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L19"},
    camp3_tent_area_L_20: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L20"},

  camp3_rv: { parentKey: "camp3", name: "RV", visible: true, children_title: "Select your RV size" },
  camp3_rv_sm: {"parentKey":"camp3_rv","name":"RV under 15' long","visible":true,"reserved":10},
    camp3_rv_sm_1: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV1"},
    camp3_rv_sm_2: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV2"},
    camp3_rv_sm_3: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV3"},
    camp3_rv_sm_4: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV4"},
    camp3_rv_sm_5: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV5"},
    camp3_rv_sm_6: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV6"},
    camp3_rv_sm_7: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV7"},
    camp3_rv_sm_8: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV8"},
    camp3_rv_sm_9: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV9"},
    camp3_rv_sm_10: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV10"},
    camp3_rv_sm_11: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV11"},
    camp3_rv_sm_12: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV12"},
    camp3_rv_sm_13: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV13"},
    camp3_rv_sm_14: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV14"},
    camp3_rv_sm_15: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV15"},
    camp3_rv_sm_16: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV16"},
    camp3_rv_sm_17: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV17"},
    camp3_rv_sm_18: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV18"},
    camp3_rv_sm_19: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV19"},
    camp3_rv_sm_20: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV20"},
  camp3_rv_lg: {"parentKey":"camp3_rv","name":"RV 15'-20' long","visible":true,"reserved":4},
    camp3_rv_lg_1: {"parentKey":"camp3_rv_lg","capacity":1,"visible":false,"name":"Spot 3LRV1"},
    camp3_rv_lg_2: {"parentKey":"camp3_rv_lg","capacity":1,"visible":false,"name":"Spot 3LRV2"},
    camp3_rv_lg_3: {"parentKey":"camp3_rv_lg","capacity":1,"visible":false,"name":"Spot 3LRV3"},
    camp3_rv_lg_4: {"parentKey":"camp3_rv_lg","capacity":1,"visible":false,"name":"Spot 3LRV4"},
    camp3_rv_lg_5: {"parentKey":"camp3_rv_lg","capacity":1,"visible":false,"name":"Spot 3LRV5"},

  camp3_cabin: { parentKey: "camp3", name: "Cabin", visible: true, children_title: "Select your cabin preference" },
  ...Array.apply(null, Array(21)).map(function () {}).reduce(
      (acc, v, i) => {
          const cabinNum = i + 1;
          let capacity = 4;

          return {
              ...acc,
              [`camp3_cabin_${cabinNum}`]: {
                  parentKey: "camp3_cabin",
                  name: `Cabin ${cabinNum}`,
                  visible: false,
                  capacity,
              },
          };
      },
      {},
  ),

};
