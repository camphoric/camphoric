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
    camp1_tent: { parentKey: "camp1", name: "Camp 1: Tent", children_title: "Select a tent area", visible: true },
    camp1_tent_area_A: { parentKey: "camp1_tent", name: "Camp 1: Tent Area A", visible: true, capacity: 30, reserved: 5 },
    camp1_tent_area_B: { parentKey: "camp1_tent", name: "Camp 1: Tent Area B", visible: true, capacity: 60, reserved: 15 },
    camp1_tent_area_C: { parentKey: "camp1_tent", name: "Camp 1: Tent Area C", visible: true, capacity: 30, reserved: 5 },

    camp1_rv: { parentKey: "camp1", name: "Camp 1: RV", visible: true, children_title: "Select your RV size" },
    camp1_rv_sm: { parentKey: "camp1_rv", name: "Camp 1: RV under 15' long", visible: true, capacity: 20, reserved: 10 },
    camp1_rv_lg: { parentKey: "camp1_rv", name: "Camp 1: RV 15'-20' long", visible: true, capacity: 5, reserved: 4 },

    camp1_cabin: { parentKey: "camp1", name: "Camp 1: Cabin", visible: true, children_title: "Select your cabin preference" },

    ...Array.apply(null, Array(46)).map(function () {}).reduce(
        (acc, v, i) => {
            const cabinNum = i + 1;

            return {
                ...acc,
                [`camp1_cabin_${cabinNum}`]: {
                    parentKey: "camp1_cabin",
                    name: `Camp 1: Cabin ${cabinNum}`,
                    visible: true,
                    capacity: 6,
                    reserved: 2,
                },
            };
        },
        {},
    ),

    // camp 2
    camp2: { parentKey: "root", name: "Camp 2", children_title: "Select a lodging type", visible: true },
    camp2_tent: { parentKey: "camp2", name: "Camp 2: Tent", children_title: "Select a tent area", visible: true },

    camp2_tent_area_D: { parentKey: "camp2_tent", name: "Camp 2: Tent Area D", visible: true, capacity: 13, reserved: 3 },
    camp2_tent_area_E: { parentKey: "camp2_tent", name: "Camp 2: Tent Area E", visible: true, capacity: 10, reserved: 2 },
    camp2_tent_area_F: { parentKey: "camp2_tent", name: "Camp 2: Tent Area F", visible: true, capacity: 13, reserved: 3 },
    camp2_tent_area_G: { parentKey: "camp2_tent", name: "Camp 2: Tent Area G", visible: true, capacity: 26, reserved: 6 },
    camp2_tent_area_H: { parentKey: "camp2_tent", name: "Camp 2: Tent Area H", visible: true, capacity: 15, reserved: 5 },

    camp2_rv: { parentKey: "camp2", name: "Camp 2: RV", visible: true, children_title: "Select your RV size" },
    camp2_rv_sm: { parentKey: "camp2_rv", name: "Camp 2: RV under 15' long", visible: true, capacity: 40, reserved: 10 },
    camp2_rv_lg: { parentKey: "camp2_rv", name: "Camp 2: RV 15'-20' long", visible: true, capacity: 10, reserved: 5 },

    camp2_cabin: { parentKey: "camp2", name: "Camp 2: Cabin", visible: true, children_title: "Select your cabin preference" },

    ...Array.apply(null, Array(32)).map(function () {}).reduce(
        (acc, v, i) => {
            const cabinNum = i + 1;
            let capacity = 6;
            let reserved = 2;

            // check for 2-bed cabins
            if (twoBedCabins2.includes(cabinNum)) {
                capacity = 3;
                reserved = 1;
            }

            return {
                ...acc,
                [`camp2_cabin_${cabinNum}`]: {
                    parentKey: "camp2_cabin",
                    name: `Camp 2: Cabin ${cabinNum}`,
                    visible: true,
                    capacity,
                    reserved,
                },
            };
        },
        {},
    ),

    camp2_cabin_GH: {
        parentKey: "camp2_cabin",
        name: `Camp 2: Gatehouse`,
        visible: false,
        capacity: 6,
    },

    // camp 3
    camp3: { parentKey: "root", name: "Camp 3", children_title: "Select a lodging type", visible: true },
    camp3_tent: { parentKey: "camp3", name: "Camp 3: Tent", children_title: "Select a tent area", visible: true },

    camp3_tent_area_I: { parentKey: "camp3_tent", name: "Camp 3: Tent Area I", visible: true, capacity: 8, reserved: 5 },
    camp3_tent_area_J: { parentKey: "camp3_tent", name: "Camp 3: Tent Area J", visible: true, capacity: 20, reserved: 5 },
    camp3_tent_area_K: { parentKey: "camp3_tent", name: "Camp 3: Tent Area K", visible: true, capacity: 10, reserved: 5 },
    camp3_tent_area_L: { parentKey: "camp3_tent", name: "Camp 3: Tent Area L", visible: true, capacity: 20, reserved: 5 },

    camp3_rv: { parentKey: "camp3", name: "Camp 3: RV", visible: true, children_title: "Select your RV size" },
    camp3_rv_sm: { parentKey: "camp3_rv", name: "Camp 3: RV under 15' long", visible: true, capacity: 20, reserved: 10 },
    camp3_rv_lg: { parentKey: "camp3_rv", name: "Camp 3: RV 15'-20' long", visible: true, capacity: 5, reserved: 4 },

    camp3_cabin: { parentKey: "camp3", name: "Camp 3: Cabin", visible: true, children_title: "Select your cabin preference" },

    ...Array.apply(null, Array(21)).map(function () {}).reduce(
        (acc, v, i) => {
            const cabinNum = i + 1;
            let capacity = 6;
            let reserved = 2;

            return {
                ...acc,
                [`camp3_cabin_${cabinNum}`]: {
                    parentKey: "camp3_cabin",
                    name: `Camp 3: Cabin ${cabinNum}`,
                    visible: true,
                    capacity,
                    reserved,
                },
            };
        },
        {},
    ),

};
