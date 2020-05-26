import {Component, ViewChild} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {ActivatedRoute} from "@angular/router";
import {PdfJsViewerComponent} from "ng2-pdfjs-viewer";
import {MessageReceiverService} from "./message-receiver.service";
import {MessageSenderService} from "./message-sender";
import {PresentationModeController} from "./PresentationModeController";

// const viewerFolder = '64fa8636-e686-4c63-9956-132d9471ce77/assets/pdfjs'

enum SpreadState {
    none,
    odd,
    even
}

@Component({
    selector: 'app-root',
    template: `<ng2-pdfjs-viewer #viewer viewerId="__uniqueViewerId" (onPageChange)="pageChanged($event)" 
                                 [page]="actualPage" [download]=false [openFile]=false 
                                 viewerFolder='64fa8636-e686-4c63-9956-132d9471ce77/assets/pdfjs' 
                                 [viewBookmark]=false pagemode='none'>
    </ng2-pdfjs-viewer>`,
    styles: []
})
export class AppComponent {
    @ViewChild('viewer')
    private viewer: PdfJsViewerComponent;

    private presentationModeController: PresentationModeController = null;

    actualPage: number;

    pageChanged(pageNumber: number) {
        this.messageSenderService.triggerEvent("pageChanged", {pageNumber});
    }

    private sendFocusTransferNotification() {
        if (!this.messageSenderService) {
            return;
        }
        this.messageSenderService.triggerEvent("frameFocused", {})
    }

    private hideToolbar() {
        const appConfig = this.viewer.PDFViewerApplication.appConfig;
        appConfig.toolbar.container.parentElement.parentElement.style.display = "none";
        appConfig.viewerContainer.parentElement.style['top'] = 0;
        appConfig.sidebar.outerContainer.querySelector("#sidebarContainer").style['top'] = 0;
    }

    private showToolbar() {
        const appConfig = this.viewer.PDFViewerApplication.appConfig;
        appConfig.toolbar.container.parentElement.parentElement.style.display = "block";
        appConfig.viewerContainer.parentElement.style['top'] = "32px";
        appConfig.sidebar.outerContainer.querySelector("#sidebarContainer").style['top'] = "32px";
    }

    private toggleToolbar() {
        const appConfig = this.viewer.PDFViewerApplication.appConfig;
        if (appConfig.toolbar.container.parentElement.parentElement.style.display == "block") {
            this.hideToolbar();
        }
        else {
            this.showToolbar();
        }
    }

    private setBackgroundColor(color: string) {
        const appConfig = this.viewer.PDFViewerApplication.appConfig;
        appConfig.appContainer.style.background = color;
        appConfig.sidebar.outerContainer.querySelector("#toolbarSidebar").style.background = color;
    }

    private collectDocumentInfo() {
        const info = {};
        Object.assign(info, this.viewer.PDFViewerApplication.pdfDocumentProperties.fieldData);
        info["fileName"] = this.fileName;
        return info;
    }

    private delayedBackgroundColor: string;
    private fileName: string;

    private parseFileName(url: string) {
        const split = decodeURIComponent(url).split("/");
        return split[split.length - 1];
    }

    private spreadState = SpreadState.none;

    private toggleOddSpread() {
        if (this.spreadState != SpreadState.odd) {
            this.viewer.PDFViewerApplication.appConfig.secondaryToolbar.spreadOddButton.click();
            this.spreadState = SpreadState.odd;
        }
        else {
            this.viewer.PDFViewerApplication.appConfig.secondaryToolbar.spreadNoneButton.click();
            this.spreadState = SpreadState.none;
        }
    }

    private toggleEvenSpread() {
        if (this.spreadState != SpreadState.even) {
            this.viewer.PDFViewerApplication.appConfig.secondaryToolbar.spreadEvenButton.click();
            this.spreadState = SpreadState.even;
        }
        else {
            this.viewer.PDFViewerApplication.appConfig.secondaryToolbar.spreadNoneButton.click();
            this.spreadState = SpreadState.none;
        }
    }

    private rotateClockwise() {
        this.viewer.PDFViewerApplication.appConfig.secondaryToolbar.pageRotateCwButton.click();
    }

    private rotateCounterclockwise() {
        this.viewer.PDFViewerApplication.appConfig.secondaryToolbar.pageRotateCcwButton.click();
    }

    private currentScrollDirectionHorizontal = false;

    private toggleScrollDirection() {
        const toolbar = this.viewer.PDFViewerApplication.appConfig.secondaryToolbar;
        if (this.currentScrollDirectionHorizontal) {
            toolbar.scrollVerticalButton.click();
            this.currentScrollDirectionHorizontal = false;
        }
        else {
            toolbar.scrollHorizontalButton.click();
            this.currentScrollDirectionHorizontal = true;
        }
    }

    private togglePresentationMode() {
        if (!this.presentationModeController) {
            console.warn("presentationModeController was null at the time of enter request.");
            return;
        }
        if (!this.presentationModeController.isFullscreen()) {
            this.presentationModeController.enter();
        }
        else {
            this.presentationModeController.exit();
        }
    }

    private createPresentationModeController() {
        this.presentationModeController = new PresentationModeController(this.viewer.PDFViewerApplication);
        this.presentationModeController.addEnterEventHandler(() => {
            this.messageSenderService.triggerEvent("presentationModeEnter", {});
        });
        this.presentationModeController.addEnterReadyEventHandler(() => {
            this.messageSenderService.triggerEvent("presentationModeEnterReady", {});
        });
        this.presentationModeController.addExitEventHandler(() => {
            this.messageSenderService.triggerEvent("presentationModeExit", {});
        });
    }
    
    private ignoredClickTargets = [];

    private buildIgnoreClickTargetsList() {
        const config = this.viewer.PDFViewerApplication.appConfig;
        let result = [
            config.findBar.findPreviousButton,
            config.findBar.findNextButton,
            config.toolbar.previous,
            config.toolbar.next,
            config.toolbar.print,
            config.toolbar.zoomOut,
            config.toolbar.zoomIn,
            this.viewer.PDFViewerApplication.pdfSidebar.toggleButton,
            config.secondaryToolbar.scrollHorizontalButton,
            config.secondaryToolbar.scrollVerticalButton,
            config.secondaryToolbar.pageRotateCcwButton,
            config.secondaryToolbar.pageRotateCwButton,
            config.secondaryToolbar.spreadEvenButton,
            config.secondaryToolbar.spreadNoneButton,
            config.secondaryToolbar.spreadOddButton,
        ];
        this.ignoredClickTargets = result;
    }

    private focusEventHandler = (event) => {
        console.log(event.target);
        if (this.ignoredClickTargets.includes(event.target)) {
            return;
        }
        this.sendFocusTransferNotification();
    };

    constructor(private http: HttpClient, private route: ActivatedRoute,
        private messageReceiverService: MessageReceiverService,
        private messageSenderService: MessageSenderService) {
        window.addEventListener("click", this.focusEventHandler);
        const subscription = this.route.queryParams.subscribe(params => {
            const targetUrl = params['path'];
            this.fileName = this.parseFileName(targetUrl);
            console.log(this.fileName);
            if (!targetUrl) {
                return;
            }
            subscription.unsubscribe();
            console.log(targetUrl);
            let request = this.http.get(targetUrl, {
                responseType: 'blob'
            });
            request.subscribe((res: Blob) => {
                this.viewer.pdfSrc = res;
                this.viewer.refresh();
                this.viewer.onDocumentLoad.subscribe(() => {
                    this.setBackgroundColor(this.delayedBackgroundColor);
                    this.hideToolbar();
                    this.viewer.PDFViewerApplication.pdfDocumentProperties.open();
                    this.viewer.PDFViewerApplication.pdfDocumentProperties.close();
                    console.log(this.viewer.PDFViewerApplication);
                    this.viewer.PDFViewerApplication.unbindWindowEvents();
                    window["debugApplication"] = this.viewer.PDFViewerApplication;
                    this.createPresentationModeController();
                    const targetDocument = this.viewer.PDFViewerApplication.pdfPresentationMode.container.ownerDocument;
                    this.buildIgnoreClickTargetsList();
                    targetDocument.addEventListener("click", this.focusEventHandler);
                });
            });
        });
        this.registerEventSubscriptions();
    }

    private registerEventSubscriptions() {
        this.messageReceiverService.subscribe("pageSet", (data: any) => {
            this.actualPage = data.pageNumber;
        });
        this.messageReceiverService.subscribe("toggleSidebar", (data: any) => {
            this.viewer.PDFViewerApplication.pdfSidebar.toggleButton.click();
            console.log(this.viewer.PDFViewerApplication);
        });
        this.messageReceiverService.subscribe("increaseScale", (data: any) => {
            this.viewer.PDFViewerApplication.appConfig.toolbar.zoomIn.click();
            // this.viewer.PDFViewerApplication.zoomIn(2);
        });
        this.messageReceiverService.subscribe("decreaseScale", (data: any) => {
            this.viewer.PDFViewerApplication.appConfig.toolbar.zoomOut.click();
            // this.viewer.PDFViewerApplication.zoomOut(2);
        });
        this.messageReceiverService.subscribe("printDocument", (data: any) => {
            this.viewer.PDFViewerApplication.appConfig.toolbar.print.click();
        });
        this.messageReceiverService.subscribe("nextPage", (data: any) => {
            this.viewer.PDFViewerApplication.appConfig.toolbar.next.click();
        });
        this.messageReceiverService.subscribe("previousPage", (data: any) => {
            this.viewer.PDFViewerApplication.appConfig.toolbar.previous.click();
        });
        this.messageReceiverService.subscribe("findNext", (data: any) => {
            this.viewer.PDFViewerApplication.appConfig.findBar.findField.value = data.searchTarget;
            this.viewer.PDFViewerApplication.appConfig.findBar.findNextButton.click();
        });
        this.messageReceiverService.subscribe("findPrevious", (data: any) => {
            this.viewer.PDFViewerApplication.appConfig.findBar.findField.value = data.searchTarget;
            this.viewer.PDFViewerApplication.appConfig.findBar.findPreviousButton.click();
        });
        this.messageReceiverService.subscribe("toggleToolbar", (data: any) => {
            this.toggleToolbar();
        });
        this.messageReceiverService.subscribe("setBackgroundColor", (data: {color: string}) => {
            this.delayedBackgroundColor = data.color;
            try {
                this.setBackgroundColor(this.delayedBackgroundColor);
            }
            catch (error) {
                console.warn("Could not set background color!");
            }
        });
        this.messageReceiverService.subscribe("getDocumentInfo", (data: any) => {
            this.messageSenderService.triggerEvent("documentInfo", this.collectDocumentInfo());
        });
        this.messageReceiverService.subscribe("toggleScrollDirection", (data: any) => {
            this.toggleScrollDirection();
        });
        this.messageReceiverService.subscribe("rotateClockwise", (data: any) => {
            this.rotateClockwise();
        });
        this.messageReceiverService.subscribe("rotateCounterclockwise", (data: any) => {
            this.rotateCounterclockwise();
        });
        this.messageReceiverService.subscribe("toggleSpreadOddPages", (data: any) => {
            this.toggleOddSpread();
        });
        this.messageReceiverService.subscribe("toggleSpreadEvenPages", (data: any) => {
            this.toggleEvenSpread();
        });
        this.messageReceiverService.subscribe("togglePresentationMode", (data: any) => {
            this.togglePresentationMode();
        });
    }
}
