/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/record', 'N/search', 'N/format', 'N/file', 'N/render', 'N/url'], (record, search, format, file, render, url) => {
    const onRequest = (context) => {
        let salesOrderRecord = record.load({
            type: record.Type.SALES_ORDER,
            id: context.request.parameters.orderId,
            isDynamic: true,
        });
        let subsidiaryRecord = record.load({
            type: record.Type.SUBSIDIARY,
            id: salesOrderRecord.getValue({
                fieldId: 'subsidiary'
            }),
            isDynamic: true,
        });
        let itemFulfillmentRecord = record.load({
            type: record.Type.ITEM_FULFILLMENT,
            id: context.request.parameters.fulfillId,
            isDynamic: true,
        });

        let employeeRecordFields = search.lookupFields({
            type: search.Type.EMPLOYEE,
            id: salesOrderRecord.getValue({
                fieldId: 'salesrep'
            }),
            columns: [
                'firstname', 
                'lastname', 
                'email',
                'phone',
                'mobilephone'
            ]
        });

        const ciData = buildCommercialInvoiceData(subsidiaryRecord, salesOrderRecord, itemFulfillmentRecord, employeeRecordFields);
        getPackageInfo(ciData, itemFulfillmentRecord);
        getItemInfo(ciData, itemFulfillmentRecord, salesOrderRecord);

        context.response.writeFile({
            file: generatePdfFile(ciData), 
            isInline: true
        });
    }

    /**
     * Builds the data object for Commercial Invoice PDF file.
     *
     * @param {Record} subsidiaryRecord
     * @param {Record} salesOrderRecord 
     * @param {Record} itemFulfillmentRecord
     * @param {Object} employeeRecordFields
     * @return {Object} Commercial Invoice data for printing
     */
    const buildCommercialInvoiceData = (subsidiaryRecord, salesOrderRecord, itemFulfillmentRecord, employeeRecordFields) => {
        let ciObject = {
            name: `${employeeRecordFields.firstname} ${employeeRecordFields.lastname}`,
            email: employeeRecordFields.email,
            phone: employeeRecordFields.phone,
            mobile: employeeRecordFields.mobilephone,
            salesOrderNr: salesOrderRecord.getValue({fieldId: 'tranid'}),
            poNo: salesOrderRecord.getValue({fieldId: 'otherrefnum'}),
            todaysDate: format.format({
                value: new Date(), 
                type: format.Type.DATE
            }),
            billingAddress: salesOrderRecord.getValue({fieldId: 'billaddress'}).replace(/(?:\r\n|\r|\n)/g, '<br />'),
            shippingAddress: salesOrderRecord.getValue({fieldId: 'shipaddress'}).replace(/(?:\r\n|\r|\n)/g, '<br />'),
            vatNr: salesOrderRecord.getText({fieldId: 'vatregnum'}),
            shippingMethod: salesOrderRecord.getText({fieldId: 'shipmethod'}),
            termsOfPayment: salesOrderRecord.getText({fieldId: 'terms'}),
            currencyname: salesOrderRecord.getValue({fieldId: 'currencyname'}),
            discountrate: salesOrderRecord.getValue({fieldId: 'discountrate'}),
            discounttotal: salesOrderRecord.getValue({fieldId: 'discounttotal'}),
            shippingcost: salesOrderRecord.getValue({fieldId: 'shippingcost'}),
            ifNumber: itemFulfillmentRecord.getValue({fieldId: 'tranid'}),
            ifDate: format.format({
                value: itemFulfillmentRecord.getValue({fieldId: 'trandate'}), 
                type: format.Type.DATE
            }),
            taxPercent: `${salesOrderRecord.getSublistValue({sublistId: 'item', fieldId: 'taxrate1', line: 0})}%`,
            footerInfo: {
                addressFormated: subsidiaryRecord.getValue({fieldId: 'mainaddress_text'}).replace(/(?:\r\n|\r|\n)/g, ', '),
                legalname: subsidiaryRecord.getValue({fieldId: 'legalname'}),
                phone: subsidiaryRecord.getSubrecord({fieldId: 'mainaddress'}).getValue({fieldId: 'addrphone'}),
                fax: subsidiaryRecord.getValue({fieldId: 'fax'}),
                email: subsidiaryRecord.getValue({fieldId: 'email'}),
                website: subsidiaryRecord.getValue({fieldId: 'url'}),
                vatId: subsidiaryRecord.getValue({fieldId: 'federalidnumber'}),
                logoUrl: getImageUrl(subsidiaryRecord.getValue({fieldId: 'logo'}))
            },
            itemFields: [],
            packages: []
        };

        return ciObject;
    }

    /**
     * Gets shipment package details.
     *
     * @param {Object} ciObject
     * @param {Record} itemFulfillmentRecord
     */
    const getPackageInfo = (ciObject, itemFulfillmentRecord) => {
        for (let i = 0; i < itemFulfillmentRecord.getLineCount({sublistId: 'package' }); i++) {
            ciObject.packages.push({
                packageweight: itemFulfillmentRecord.getSublistValue({
                    sublistId: 'package', 
                    line: i, 
                    fieldId: 'packageweight'
                }),
                packagedescr: itemFulfillmentRecord.getSublistValue({
                    sublistId: 'package', 
                    line: i, 
                    fieldId: 'packagedescr'
                }),
                packagetrackingnumber: itemFulfillmentRecord.getSublistValue({
                    sublistId: 'package', 
                    line: i, 
                    fieldId: 'packagetrackingnumber'
                })
            });
        }
    }

    /**
     * Gets item details.
     *
     * @param {Object} ciObject
     * @param {Record} itemFulfillmentRecord
     * @param {Record} salesOrderRecord
     */
    const getItemInfo = (ciObject, itemFulfillmentRecord, salesOrderRecord) => {
        for (let i = 0; i < itemFulfillmentRecord.getLineCount({sublistId: 'item' }); i++) {
            let salesOrderLineId = salesOrderRecord.findSublistLineWithValue({
                sublistId: 'item', 
                fieldId: 'line', 
                value: itemFulfillmentRecord.getSublistValue({
                    sublistId: 'item', 
                    fieldId: 'orderline', 
                    line: i 
                })
            });
            let itemDetails = search.lookupFields({
                type: 'item', 
                id: itemFulfillmentRecord.getSublistValue({
                    sublistId: 'item', 
                    fieldId: 'item', 
                    line: i
                }), 
                columns: [
                    'countryofmanufacture'
                ]
            });

            itemDetails.itemtype= 'Inventory';
            
            itemDetails.itemName = itemFulfillmentRecord.getSublistValue({
                sublistId: 'item', 
                fieldId: 'itemname', 
                line: i
            });
            itemDetails.itemDescription = itemFulfillmentRecord.getSublistValue({
                sublistId: 'item', 
                fieldId: 'itemdescription', 
                line: i
            });
            itemDetails.itemQuantity = Number(itemFulfillmentRecord.getSublistValue({
                sublistId: 'item', 
                fieldId: 'itemquantity', 
                line: i
            }));
            if (![null, undefined, ''].includes(itemFulfillmentRecord.getSublistValue({sublistId: 'item', line: i, fieldId: 'inventorydetail'}))) {
                let serialNumbers = '';
                itemFulfillmentRecord.selectLine({
                    sublistId: 'item',
                    line: i
                })
                let inventoryDetail = itemFulfillmentRecord.getCurrentSublistSubrecord({
                    sublistId: 'item', 
                    fieldId: 'inventorydetail'
                });
                for (let j = 0; j < inventoryDetail.getLineCount({sublistId: 'inventoryassignment'}); j++) {
                    let serialNumber = inventoryDetail.getSublistText({
                        sublistId: 'inventoryassignment',
                        fieldId: 'issueinventorynumber',
                        line: j
                    });

                    if (![null, undefined, ''].includes(serialNumber)) {
                        serialNumbers += serialNumbers == '' ? serialNumber : `, ${serialNumber}`;
                    }
                }

                itemDetails.serials = serialNumbers;
            }

            itemDetails.soItemUnitPrice = salesOrderRecord.getSublistValue({
                sublistId: 'item', 
                fieldId: 'rate', 
                line: salesOrderLineId
            });
            itemDetails.soItemTaxAmount = salesOrderRecord.getSublistValue({
                sublistId: 'item', 
                fieldId: 'tax1amt', 
                line: salesOrderLineId
            });
            itemDetails.soItemQuantity = salesOrderRecord.getSublistValue({
                sublistId: 'item', 
                fieldId: 'quantity', 
                line: salesOrderLineId
            });
            itemDetails.soItemTaxUnitAmount = itemDetails.soItemTaxAmount / itemDetails.soItemQuantity;
            ciObject.itemFields.push(itemDetails);

            let soNextLineId = salesOrderLineId + 1;
            if (salesOrderRecord.getLineCount({sublistId: 'item'}) > soNextLineId) {
                let soItemType = salesOrderRecord.getSublistValue({
                    sublistId: 'item', 
                    fieldId: 'itemtype', 
                    line: soNextLineId
                });
    
                if (soItemType === 'Discount') {
                    let discountDetails = {};
                    discountDetails.itemtype = 'Discount';
                    discountDetails.itemDescription = 'Discount';
                    discountDetails.itemQuantity = 1;
                    discountDetails.soItemDiscountRate = salesOrderRecord.getSublistValue({
                        sublistId: 'item', 
                        fieldId: 'rate', 
                        line: soNextLineId
                    });
                    discountDetails.soItemAmount = salesOrderRecord.getSublistValue({
                        sublistId: 'item', 
                        fieldId: 'amount', 
                        line: soNextLineId
                    });
                    discountDetails.soItemUnitPrice = salesOrderRecord.getSublistValue({
                        sublistId: 'item', 
                        fieldId: 'rate', 
                        line: soNextLineId
                    });
                    discountDetails.soItemTaxAmount = salesOrderRecord.getSublistValue({
                        sublistId: 'item', 
                        fieldId: 'tax1amt', 
                        line: soNextLineId
                    });
                    discountDetails.soItemTaxUnitAmount = discountDetails.soItemTaxAmount / itemDetails.soItemQuantity;

                    ciObject.itemFields.push(discountDetails);
                }
            }
        }
    }

    /**
     * Renders PDF file
     *
     * @param {Object} jsonData - Commercial Invoice data
     * @return {File} Generated PDF File
     */
    const generatePdfFile = (jsonData) => {
        let xmlTmplFile = file.load({
            id: "SuiteScripts/commercial-invoice/pdftemplates/custtmpl_nse_ci.template.xml"
        });

        let templateRenderer = render.create();
        templateRenderer.templateContent = xmlTmplFile.getContents()
        templateRenderer.addCustomDataSource({
            format: render.DataSource.OBJECT,
            alias: "record",
            data: jsonData
        });

        let pdfFile = templateRenderer.renderAsPdf();
        pdfFile.name = `Commercial Invoice.pdf`;

        return pdfFile;
    }

    /**
     * Builds Image URL to be used in PDF file
     *
     * @param {Number} imageId
     * @return {String} Image URL
     */
    const getImageUrl = (imageId) => {
        const imageDetails = search.lookupFields({
            type: 'file', 
            id: imageId,
            columns: ['url']
        });

        const appDomain = url.resolveDomain({
            hostType: url.HostType.APPLICATION
        });

        return `https://${appDomain}${imageDetails.url.replace(/&/g, '&amp;')}`;
    }

    return {
        onRequest
    };
}); 