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
    camp1_tent_area_A_01: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A01"},
    camp1_tent_area_A_02: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A02"},
    camp1_tent_area_A_03: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A03"},
    camp1_tent_area_A_04: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A04"},
    camp1_tent_area_A_05: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A05"},
    camp1_tent_area_A_06: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A06"},
    camp1_tent_area_A_07: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A07"},
    camp1_tent_area_A_08: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A08"},
    camp1_tent_area_A_09: {"parentKey":"camp1_tent_area_A","capacity":1,"visible":false,"name":"Spot A09"},
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
    camp1_tent_area_B_01: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B01"},
    camp1_tent_area_B_02: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B02"},
    camp1_tent_area_B_03: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B03"},
    camp1_tent_area_B_04: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B04"},
    camp1_tent_area_B_05: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B05"},
    camp1_tent_area_B_06: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B06"},
    camp1_tent_area_B_07: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B07"},
    camp1_tent_area_B_08: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B08"},
    camp1_tent_area_B_09: {"parentKey":"camp1_tent_area_B","capacity":1,"visible":false,"name":"Spot B09"},
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
    camp1_tent_area_C_01: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C01"},
    camp1_tent_area_C_02: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C02"},
    camp1_tent_area_C_03: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C03"},
    camp1_tent_area_C_04: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C04"},
    camp1_tent_area_C_05: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C05"},
    camp1_tent_area_C_06: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C06"},
    camp1_tent_area_C_07: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C07"},
    camp1_tent_area_C_08: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C08"},
    camp1_tent_area_C_09: {"parentKey":"camp1_tent_area_C","capacity":1,"visible":false,"name":"Spot C09"},
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
    camp1_rv_sm_01: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV01"},
    camp1_rv_sm_02: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV02"},
    camp1_rv_sm_03: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV03"},
    camp1_rv_sm_04: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV04"},
    camp1_rv_sm_05: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV05"},
    camp1_rv_sm_06: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV06"},
    camp1_rv_sm_07: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV07"},
    camp1_rv_sm_08: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV08"},
    camp1_rv_sm_09: {"parentKey":"camp1_rv_sm","capacity":1,"visible":false,"name":"Spot 1SRV09"},
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
    camp1_rv_lg_01: {"parentKey":"camp1_rv_lg","capacity":1,"visible":false,"name":"Spot 1LRV01"},
    camp1_rv_lg_02: {"parentKey":"camp1_rv_lg","capacity":1,"visible":false,"name":"Spot 1LRV02"},
    camp1_rv_lg_03: {"parentKey":"camp1_rv_lg","capacity":1,"visible":false,"name":"Spot 1LRV03"},
    camp1_rv_lg_04: {"parentKey":"camp1_rv_lg","capacity":1,"visible":false,"name":"Spot 1LRV04"},
    camp1_rv_lg_05: {"parentKey":"camp1_rv_lg","capacity":1,"visible":false,"name":"Spot 1LRV05"},

  camp1_cabin: { parentKey: "camp1", name: "Cabin", visible: true, children_title: "Select your cabin preference" },

  ...Array.apply(null, Array(46)).map(function () {}).reduce(
      (acc, v, i) => {
          const cabinNum = (i + 1).toString().padStart(2, '0');

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
    camp2_tent_area_D_01: {"parentKey":"camp2_tent_area_D","capacity":1,"visible":false,"name":"Spot D01"},
    camp2_tent_area_D_02: {"parentKey":"camp2_tent_area_D","capacity":1,"visible":false,"name":"Spot D02"},
    camp2_tent_area_D_03: {"parentKey":"camp2_tent_area_D","capacity":1,"visible":false,"name":"Spot D03"},
    camp2_tent_area_D_04: {"parentKey":"camp2_tent_area_D","capacity":1,"visible":false,"name":"Spot D04"},
    camp2_tent_area_D_05: {"parentKey":"camp2_tent_area_D","capacity":1,"visible":false,"name":"Spot D05"},
    camp2_tent_area_D_06: {"parentKey":"camp2_tent_area_D","capacity":1,"visible":false,"name":"Spot D06"},
    camp2_tent_area_D_07: {"parentKey":"camp2_tent_area_D","capacity":1,"visible":false,"name":"Spot D07"},
    camp2_tent_area_D_08: {"parentKey":"camp2_tent_area_D","capacity":1,"visible":false,"name":"Spot D08"},
    camp2_tent_area_D_09: {"parentKey":"camp2_tent_area_D","capacity":1,"visible":false,"name":"Spot D09"},
  camp2_tent_area_E: {"parentKey":"camp2_tent","name":"Area E","visible":true,"reserved":2},
    camp2_tent_area_E_01: {"parentKey":"camp2_tent_area_E","capacity":1,"visible":false,"name":"Spot E01"},
    camp2_tent_area_E_02: {"parentKey":"camp2_tent_area_E","capacity":1,"visible":false,"name":"Spot E02"},
    camp2_tent_area_E_03: {"parentKey":"camp2_tent_area_E","capacity":1,"visible":false,"name":"Spot E03"},
    camp2_tent_area_E_04: {"parentKey":"camp2_tent_area_E","capacity":1,"visible":false,"name":"Spot E04"},
    camp2_tent_area_E_05: {"parentKey":"camp2_tent_area_E","capacity":1,"visible":false,"name":"Spot E05"},
    camp2_tent_area_E_06: {"parentKey":"camp2_tent_area_E","capacity":1,"visible":false,"name":"Spot E06"},
    camp2_tent_area_E_07: {"parentKey":"camp2_tent_area_E","capacity":1,"visible":false,"name":"Spot E07"},
    camp2_tent_area_E_08: {"parentKey":"camp2_tent_area_E","capacity":1,"visible":false,"name":"Spot E08"},
    camp2_tent_area_E_09: {"parentKey":"camp2_tent_area_E","capacity":1,"visible":false,"name":"Spot E09"},
    camp2_tent_area_E_10: {"parentKey":"camp2_tent_area_E","capacity":1,"visible":false,"name":"Spot E10"},
  camp2_tent_area_F: {"parentKey":"camp2_tent","name":"Area F","visible":true,"reserved":2},
    camp2_tent_area_F_01: {"parentKey":"camp2_tent_area_F","capacity":1,"visible":false,"name":"Spot F01"},
    camp2_tent_area_F_02: {"parentKey":"camp2_tent_area_F","capacity":1,"visible":false,"name":"Spot F02"},
    camp2_tent_area_F_03: {"parentKey":"camp2_tent_area_F","capacity":1,"visible":false,"name":"Spot F03"},
    camp2_tent_area_F_04: {"parentKey":"camp2_tent_area_F","capacity":1,"visible":false,"name":"Spot F04"},
    camp2_tent_area_F_05: {"parentKey":"camp2_tent_area_F","capacity":1,"visible":false,"name":"Spot F05"},
    camp2_tent_area_F_06: {"parentKey":"camp2_tent_area_F","capacity":1,"visible":false,"name":"Spot F06"},
    camp2_tent_area_F_07: {"parentKey":"camp2_tent_area_F","capacity":1,"visible":false,"name":"Spot F07"},
    camp2_tent_area_F_08: {"parentKey":"camp2_tent_area_F","capacity":1,"visible":false,"name":"Spot F08"},
    camp2_tent_area_F_09: {"parentKey":"camp2_tent_area_F","capacity":1,"visible":false,"name":"Spot F09"},
    camp2_tent_area_F_10: {"parentKey":"camp2_tent_area_F","capacity":1,"visible":false,"name":"Spot F10"},
  camp2_tent_area_G: {"parentKey":"camp2_tent","name":"Area G","visible":true,"reserved":2,},
    camp2_tent_area_G_01: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G01"},
    camp2_tent_area_G_02: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G02"},
    camp2_tent_area_G_03: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G03"},
    camp2_tent_area_G_04: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G04"},
    camp2_tent_area_G_05: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G05"},
    camp2_tent_area_G_06: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G06"},
    camp2_tent_area_G_07: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G07"},
    camp2_tent_area_G_08: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G08"},
    camp2_tent_area_G_09: {"parentKey":"camp2_tent_area_G","capacity":1,"visible":false,"name":"Spot G09"},
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
    camp2_tent_area_H_01: {"parentKey":"camp2_tent_area_H","capacity":1,"visible":false,"name":"Spot H01"},
    camp2_tent_area_H_02: {"parentKey":"camp2_tent_area_H","capacity":1,"visible":false,"name":"Spot H02"},
    camp2_tent_area_H_03: {"parentKey":"camp2_tent_area_H","capacity":1,"visible":false,"name":"Spot H03"},
    camp2_tent_area_H_04: {"parentKey":"camp2_tent_area_H","capacity":1,"visible":false,"name":"Spot H04"},
    camp2_tent_area_H_05: {"parentKey":"camp2_tent_area_H","capacity":1,"visible":false,"name":"Spot H05"},
    camp2_tent_area_H_06: {"parentKey":"camp2_tent_area_H","capacity":1,"visible":false,"name":"Spot H06"},
    camp2_tent_area_H_07: {"parentKey":"camp2_tent_area_H","capacity":1,"visible":false,"name":"Spot H07"},
    camp2_tent_area_H_08: {"parentKey":"camp2_tent_area_H","capacity":1,"visible":false,"name":"Spot H08"},
    camp2_tent_area_H_09: {"parentKey":"camp2_tent_area_H","capacity":1,"visible":false,"name":"Spot H09"},
    camp2_tent_area_H_10: {"parentKey":"camp2_tent_area_H","capacity":1,"visible":false,"name":"Spot H10"},

  camp2_rv: { parentKey: "camp2", name: "RV", visible: true, children_title: "Select your RV size" },
  camp2_rv_sm: {"parentKey":"camp2_rv","name":"RV under 15' long","visible":true,"reserved":10},
    camp2_rv_sm_01: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV01"},
    camp2_rv_sm_02: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV02"},
    camp2_rv_sm_03: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV03"},
    camp2_rv_sm_04: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV04"},
    camp2_rv_sm_05: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV05"},
    camp2_rv_sm_06: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV06"},
    camp2_rv_sm_07: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV07"},
    camp2_rv_sm_08: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV08"},
    camp2_rv_sm_09: {"parentKey":"camp2_rv_sm","capacity":1,"visible":false,"name":"Spot 2SRV09"},
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
    camp2_rv_lg_01: {"parentKey":"camp2_rv_lg","capacity":1,"visible":false,"name":"Spot 2LRV01"},
    camp2_rv_lg_02: {"parentKey":"camp2_rv_lg","capacity":1,"visible":false,"name":"Spot 2LRV02"},
    camp2_rv_lg_03: {"parentKey":"camp2_rv_lg","capacity":1,"visible":false,"name":"Spot 2LRV03"},
    camp2_rv_lg_04: {"parentKey":"camp2_rv_lg","capacity":1,"visible":false,"name":"Spot 2LRV04"},
    camp2_rv_lg_05: {"parentKey":"camp2_rv_lg","capacity":1,"visible":false,"name":"Spot 2LRV05"},
    camp2_rv_lg_06: {"parentKey":"camp2_rv_lg","capacity":1,"visible":false,"name":"Spot 2LRV06"},
    camp2_rv_lg_07: {"parentKey":"camp2_rv_lg","capacity":1,"visible":false,"name":"Spot 2LRV07"},
    camp2_rv_lg_08: {"parentKey":"camp2_rv_lg","capacity":1,"visible":false,"name":"Spot 2LRV08"},
    camp2_rv_lg_09: {"parentKey":"camp2_rv_lg","capacity":1,"visible":false,"name":"Spot 2LRV09"},
    camp2_rv_lg_10: {"parentKey":"camp2_rv_lg","capacity":1,"visible":false,"name":"Spot 2LRV10"},
  camp2_rv_xl: {"parentKey":"camp2_rv","name":"RV over 20' long (call ahead)","visible":true,"reserved":3},
    camp2_rv_xl_01: {"parentKey":"camp2_rv_xl","capacity":1,"visible":false,"name":"Spot 2XLRV01"},
    camp2_rv_xl_02: {"parentKey":"camp2_rv_xl","capacity":1,"visible":false,"name":"Spot 2XLRV02"},
    camp2_rv_xl_03: {"parentKey":"camp2_rv_xl","capacity":1,"visible":false,"name":"Spot 2XLRV03"},
    camp2_rv_xl_04: {"parentKey":"camp2_rv_xl","capacity":1,"visible":false,"name":"Spot 2XLRV04"},
    camp2_rv_xl_05: {"parentKey":"camp2_rv_xl","capacity":1,"visible":false,"name":"Spot 2XLRV05"},

  camp2_cabin: { parentKey: "camp2", name: "Cabin", visible: true, children_title: "Select your cabin preference" },

  ...Array.apply(null, Array(32)).map(function () {}).reduce(
      (acc, v, i) => {
          const cabinNum = (i + 1).toString().padStart(2, '0');
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
    camp3_tent_area_I_01: {"parentKey":"camp3_tent_area_I","capacity":1,"visible":false,"name":"Spot I01"},
    camp3_tent_area_I_02: {"parentKey":"camp3_tent_area_I","capacity":1,"visible":false,"name":"Spot I02"},
    camp3_tent_area_I_03: {"parentKey":"camp3_tent_area_I","capacity":1,"visible":false,"name":"Spot I03"},
    camp3_tent_area_I_04: {"parentKey":"camp3_tent_area_I","capacity":1,"visible":false,"name":"Spot I04"},
    camp3_tent_area_I_05: {"parentKey":"camp3_tent_area_I","capacity":1,"visible":false,"name":"Spot I05"},
  camp3_tent_area_J: {"parentKey":"camp3_tent","name":"Area J","visible":true,"reserved":2,},
    camp3_tent_area_J_01: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J01"},
    camp3_tent_area_J_02: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J02"},
    camp3_tent_area_J_03: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J03"},
    camp3_tent_area_J_04: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J04"},
    camp3_tent_area_J_05: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J05"},
    camp3_tent_area_J_06: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J06"},
    camp3_tent_area_J_07: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J07"},
    camp3_tent_area_J_08: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J08"},
    camp3_tent_area_J_09: {"parentKey":"camp3_tent_area_J","capacity":1,"visible":false,"name":"Spot J09"},
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
    camp3_tent_area_K_01: {"parentKey":"camp3_tent_area_K","capacity":1,"visible":false,"name":"Spot K01"},
    camp3_tent_area_K_02: {"parentKey":"camp3_tent_area_K","capacity":1,"visible":false,"name":"Spot K02"},
    camp3_tent_area_K_03: {"parentKey":"camp3_tent_area_K","capacity":1,"visible":false,"name":"Spot K03"},
    camp3_tent_area_K_04: {"parentKey":"camp3_tent_area_K","capacity":1,"visible":false,"name":"Spot K04"},
    camp3_tent_area_K_05: {"parentKey":"camp3_tent_area_K","capacity":1,"visible":false,"name":"Spot K05"},
    camp3_tent_area_K_06: {"parentKey":"camp3_tent_area_K","capacity":1,"visible":false,"name":"Spot K06"},
    camp3_tent_area_K_07: {"parentKey":"camp3_tent_area_K","capacity":1,"visible":false,"name":"Spot K07"},
    camp3_tent_area_K_08: {"parentKey":"camp3_tent_area_K","capacity":1,"visible":false,"name":"Spot K08"},
    camp3_tent_area_K_09: {"parentKey":"camp3_tent_area_K","capacity":1,"visible":false,"name":"Spot K09"},
    camp3_tent_area_K_10: {"parentKey":"camp3_tent_area_K","capacity":1,"visible":false,"name":"Spot K10"},
  camp3_tent_area_L: {"parentKey":"camp3_tent","name":"Area L","visible":true,"reserved":2,},
    camp3_tent_area_L_01: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L01"},
    camp3_tent_area_L_02: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L02"},
    camp3_tent_area_L_03: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L03"},
    camp3_tent_area_L_04: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L04"},
    camp3_tent_area_L_05: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L05"},
    camp3_tent_area_L_06: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L06"},
    camp3_tent_area_L_07: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L07"},
    camp3_tent_area_L_08: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L08"},
    camp3_tent_area_L_09: {"parentKey":"camp3_tent_area_L","capacity":1,"visible":false,"name":"Spot L09"},
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
    camp3_rv_sm_01: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV01"},
    camp3_rv_sm_02: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV02"},
    camp3_rv_sm_03: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV03"},
    camp3_rv_sm_04: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV04"},
    camp3_rv_sm_05: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV05"},
    camp3_rv_sm_06: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV06"},
    camp3_rv_sm_07: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV07"},
    camp3_rv_sm_08: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV08"},
    camp3_rv_sm_09: {"parentKey":"camp3_rv_sm","capacity":1,"visible":false,"name":"Spot 3SRV09"},
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
    camp3_rv_lg_01: {"parentKey":"camp3_rv_lg","capacity":1,"visible":false,"name":"Spot 3LRV01"},
    camp3_rv_lg_02: {"parentKey":"camp3_rv_lg","capacity":1,"visible":false,"name":"Spot 3LRV02"},
    camp3_rv_lg_03: {"parentKey":"camp3_rv_lg","capacity":1,"visible":false,"name":"Spot 3LRV03"},
    camp3_rv_lg_04: {"parentKey":"camp3_rv_lg","capacity":1,"visible":false,"name":"Spot 3LRV04"},
    camp3_rv_lg_05: {"parentKey":"camp3_rv_lg","capacity":1,"visible":false,"name":"Spot 3LRV05"},

  camp3_cabin: { parentKey: "camp3", name: "Cabin", visible: true, children_title: "Select your cabin preference" },
  ...Array.apply(null, Array(21)).map(function () {}).reduce(
      (acc, v, i) => {
          const cabinNum = (i + 1).toString().padStart(2, '0');
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
