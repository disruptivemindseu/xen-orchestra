/**
 * @import {XoHost, XoSr, XoVm} from "@vates/types"
 * @import {AlarmChanges, MonitorStrategy} from "./Strategy.js"
 */

import { createLogger } from '@xen-orchestra/log'
import { MonitorRuleSet } from './Rules.js'

import templates from './templates/index.js'
import { HybridStrategy } from './HybridStrategy.js'
export { configurationSchema } from './schema.js'

const logger = createLogger('xo:xo-server-perf-alert')

logger.debug('DEBUG ENABLED')

class PerfAlertXoPlugin {
  /**
   * @type {MonitorRuleSet | undefined}
   */
  #monitorRuleSet

  #configuration

  /**
   * @type {MonitorStrategy|undefined}
   */

  #strategy

  constructor(xo) {
    this._xo = xo
  }

  /**
   *
   * @param {AlarmChanges} param0
   * @returns
   */
  async sendAlarmChange({ newAlarms, closedAlarms, activeAlarms }) {
    if (newAlarms.size === 0 && closedAlarms.size === 0) {
      // don't send anything is the alarms didn't change
      return
    }
    const byRules = {}
    newAlarms.forEach(alarm => {
      byRules[alarm.rule.id] = byRules[alarm.rule.id] ?? { alarms: [] }
      byRules[alarm.rule.id].alarms.push({
        ...alarm,
        url: this._generateUrl(alarm.rule.objectType, alarm.target),
        notificationType: 'new',
      })
    })

    activeAlarms.forEach(alarm => {
      byRules[alarm.rule.id] = byRules[alarm.rule.id] ?? { alarms: [] }
      byRules[alarm.rule.id].alarms.push({
        ...alarm,
        url: this._generateUrl(alarm.rule.objectType, alarm.target),
        notificationType: 'active',
      })
    })

    closedAlarms.forEach(alarm => {
      byRules[alarm.rule.id] = byRules[alarm.rule.id] ?? { alarms: [] }
      byRules[alarm.rule.id].alarms.push({
        ...alarm,
        value: '', // we don't want to show the old value for closed Alarms
        url: this._generateUrl(alarm.rule.objectType, alarm.target),
        notificationType: 'closed',
      })
    })

    let subject = ''
    if (newAlarms.size > 0) {
      if (activeAlarms.size === 0) {
        subject = '❌ Performance Alerts: Alerting has started'
      } else {
        subject = `❌ Performance Alerts: ${newAlarms.size} new alert(s) detected`
        if (closedAlarms.size > 0) {
          subject += `, ✅ ${closedAlarms.size} alert(s) resolved`
        }
      }
    } else {
      if (activeAlarms.size === 0) {
        subject = '✅ Performance Alerts: All alerts resolved'
      } else {
        subject = `✅ Performance Alerts: ${closedAlarms.size} alert(s) resolved`
      }
    }
    const { html } = await templates.mjml.transform(templates.mjml.$newAlarms({ byRules }))
    const text = await templates['matrix-text'].$newAlarms({ byRules })
    const { html: matrixHtml } = await templates['matrix-html'].transform(templates['matrix-html'].$newAlarms({ byRules }))

    await this._sendAlerts(subject, html, text, matrixHtml)
  }

  /**
   * Send alerts via configured channels (email and/or Matrix)
   * @param {string} subject
   * @param {string} html
   * @param {string} text
   * @param {string} matrixHtml
   */
  async _sendAlerts(subject, html, text, matrixHtml) {
    const promises = []

    if (this.#configuration.toEmails !== undefined && this._xo.sendEmail !== undefined) {
      promises.push(
        Promise.resolve(
          this._xo.sendEmail({
            to: this.#configuration.toEmails,
            subject,
            html,
            text,
          })
        ).catch(error => {
          logger.error('[WARN] plugin perf-alert: Failed to send email:', error.message)
        })
      )
    }

    if (this.#configuration.matrixRoomId !== undefined && this._xo.sendMatrixMessage !== undefined) {
      promises.push(this._sendMatrixAlert(subject, text, matrixHtml).catch(error => {
        logger.error('[WARN] plugin perf-alert: Failed to send Matrix alert:', error.message)
      }))
    }

    await Promise.all(promises)
  }

  /**
   * Send alert via Matrix using the transport-matrix plugin
   * @param {string} subject
   * @param {string} text
   * @param {string} matrixHtml
   */
  async _sendMatrixAlert(subject, text, matrixHtml) {
    return this._xo.sendMatrixMessage({
      roomId: this.#configuration.matrixRoomId,
      content: {
        msgtype: 'm.text',
        body: `${subject}\n\n${text}`,
        format: 'org.matrix.custom.html',
        formatted_body: `<h3>${subject}</h3>\n${matrixHtml}`,
      },
    })
  }

  async load() {
    if (this.#strategy) {
      return
    }
    this.#monitorRuleSet = new MonitorRuleSet(this.#configuration)
    this.#strategy = new HybridStrategy(this._xo, this.#monitorRuleSet)

    this.#strategy.watch(changes => this.sendAlarmChange(changes), 60 * 1000).catch(console.error)
  }

  async unload() {
    await this.#strategy?.stopWatch()
    this.#strategy = undefined
  }

  async configure(configuration, state) {
    this.#configuration = configuration
    await this.unload()
    if (state.loaded) {
      await this.load()
    }
  }

  /**
   *
   * @param {string} type
   * @param {XoHost|XoSr|XoVm} object
   * @returns
   */
  _generateUrl(type, object) {
    const { baseUrl } = this.#configuration
    const { uuid } = object
    switch (type) {
      case 'VM':
        return `${baseUrl}#/vms/${uuid}/stats`
      case 'host':
        return `${baseUrl}#/hosts/${uuid}/stats`
      case 'sr':
        return `${baseUrl}#/srs/${uuid}/general`
      default:
        return `unknown type ${type}`
    }
  }

  async test() {}
}

exports.default = function ({ xo }) {
  return new PerfAlertXoPlugin(xo)
}
