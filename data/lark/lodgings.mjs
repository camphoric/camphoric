    //event = models.ForeignKey(Event, on_delete=models.CASCADE)
    //parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True)
    //name = models.CharField(max_length=255)
    //children_title = models.CharField(
        //max_length=255, blank=True, default='',
        //help_text="title that goes on the dropdown field to select a child")
    //# For non-leaf nodes, "capacity" and "reserved" should be set to zero. 
    //capacity = models.IntegerField(default=0, help_text="total camper capacity") 
    //reserved = models.IntegerField(default=0, help_text="number of reserved spots remaining")
    //visible = models.BooleanField(default=False, help_text="true if visible on registration form")
    //notes = models.TextField(blank=True, default='')

export default {
    root: {
        name: "Lodging",
        children_title: "Select a camp",
        visible: true,
    },
    camp1: {
        parentKey: "root",
        name: "Camp 1",
        children_title: "Select a lodging type",
        visible: true,
    },
    camp2: {
        parentKey: "root",
        name: "Camp 2",
        children_title: "Select a lodging type",
        visible: true,
    },

    camp1_tent: {
        parentKey: "camp1",
        name: "Camp 1: Tent",
        visible: true,
    },
    camp1_rv: {
        parentKey: "camp1",
        name: "Camp 1: RV",
        visible: true,
    },
    camp1_cabin: {
        parentKey: "camp1",
        name: "Camp 1: Cabin",
        visible: true,
    },

    camp2_tent: {
        parentKey: "camp2",
        name: "Camp 2: Tent",
        visible: true,
    },
    camp2_rv: {
        parentKey: "camp2",
        name: "Camp 2: RV",
        visible: true,
    },
    camp2_cabin: {
        parentKey: "camp2",
        name: "Camp 2: Cabin",
        visible: true,
    },
};
