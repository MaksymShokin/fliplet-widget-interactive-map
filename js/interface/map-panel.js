Fliplet.InteractiveMap.component('map-panel', {
  componentName: 'Map Panel',
  props: {
    id: {
      type: String,
      default: ''
    },
    name: {
      type: String,
      default: ''
    },
    image: {
      type: Object,
      default: undefined
    },
    type: {
      type: String,
      default: 'map-panel'
    },
    isFromNew: {
      type: Boolean,
      default: true
    }
  },
  methods: {
    onInputData(imageSaved) {
      const componentData = _.pick(this, ['id', 'name', 'image', 'type', 'isFromNew'])
      Fliplet.InteractiveMap.emit('map-panel-settings-changed', componentData)
      if (imageSaved) {
        Fliplet.InteractiveMap.emit('new-map-added')
      }
    },
    openMapPicker() {
      let _this = this

      let appId = _.keys(__widgetData)[0]
      let dataSourceId = __widgetData[appId].data.markersDataSourceId
      let dataSourceConnection
      let decidedToKeepMarkers = false
      let imageWidth
      let imageHeight

      Fliplet.DataSources.connect(dataSourceId).then(function (connection) {
        dataSourceConnection = connection
        connection.find({where: {['Map name']: _this.name}}).then(records => {
          if (records.length) {
            Fliplet.Modal.confirm({
              title: 'Change image',
              message: 'Do you want to keep the existing markers?',
              buttons: {
                confirm: {
                  label: 'Keep the markers',
                  className: 'btn-success'
                },
                cancel: {
                  label: 'Delete the markers',
                  className: 'btn-danger'
                }
              }
            }).then(result => {
              if (result) {
                imageWidth = _this.image.size[0]
                imageHeight = _this.image.size[1]
                decidedToKeepMarkers = true
              } else {
                records.forEach(elem => {
                  dataSourceConnection.removeById(elem.id)
                })
                Fliplet.Studio.emit('reload-widget-instance', appId)
              }
            })
          }
        })
      })

      Fliplet.Widget.toggleCancelButton(false)

      const filePickerData = {
        selectFiles: this.image ? [this.image] : [],
        selectMultiple: false,
        type: 'image',
        fileExtension: ['JPG', 'JPEG', 'PNG', 'GIF', 'TIFF', 'SVG'],
        autoSelectOnUpload: true
      }

      window.filePickerProvider = Fliplet.Widget.open('com.fliplet.file-picker', {
        data: filePickerData,
        onEvent: (e, data) => {
          switch (e) {
            case 'widget-set-info':
              Fliplet.Studio.emit('widget-save-label-reset')
              Fliplet.Studio.emit('widget-save-label-update', {
                text: 'Select'
              })
              Fliplet.Widget.toggleSaveButton(!!data.length)
              break
          }
        }
      })

      window.filePickerProvider.then((result) => {
        if (decidedToKeepMarkers) {
          let newImageWidth = result.data[0].size[0]
          let newImageHeight = result.data[0].size[1]

          if (newImageWidth !== imageWidth && newImageHeight !== imageHeight) {
            let widthRatioDifference = newImageWidth/imageWidth
            let heightRatioDifference = newImageHeight/imageHeight

            dataSourceConnection.find().then(records => {
              let entries = records.map(elem => {
                if (elem.data['Map name'] === _this.name) {
                  elem.data['Position X'] *= widthRatioDifference
                  elem.data['Position Y'] *= heightRatioDifference
                }
                return elem
              })
              let columns = _.keys(records[0].data)

              dataSourceConnection.commit(entries, columns)
            })
            Fliplet.Studio.emit('reload-widget-instance', appId)
          }
        }

        Fliplet.Widget.toggleCancelButton(true)
        let imageUrl = result.data[0].url
        const pattern = /[?&]size=/

        if (!pattern.test(imageUrl)) {
          const params = imageUrl.substring(1).split('?');
          imageUrl += (params.length > 1 ? '&' : '?') + 'size=large'
        }

        result.data[0].url = imageUrl
        this.image = result.data[0]
        this.onInputData(true)
        window.filePickerProvider = null
        Fliplet.Studio.emit('widget-save-label-reset')
        return Promise.resolve()
      })
    }
  },
  created() {
    Fliplet.InteractiveMap.on('maps-save', this.onInputData)
  },
  destroyed() {
    Fliplet.InteractiveMap.off('maps-save', this.onInputData)
  }
})

Fliplet.Widget.onCancelRequest(function () {
  var providersNames = [
    'filePickerProvider',
    'iconPickerProvider'
  ]

  _.each(providersNames, function (providerName) {
    if (window[providerName]) {
      window[providerName].close()
      window[providerName] = null
    }
  })

  Fliplet.Widget.toggleSaveButton(true)
  Fliplet.Widget.toggleCancelButton(true)
  Fliplet.Studio.emit('widget-save-label-reset')
})
